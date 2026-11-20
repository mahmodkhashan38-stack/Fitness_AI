import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import type { AppConfig } from './config/env.js'
import type { DatabaseStatus } from './database/connection.js'
import { csrfProtection } from './middleware/csrf.js'
import { errorHandler, notFound } from './middleware/error-handler.js'
import { proxyGate } from './middleware/proxy-gate.js'
import {
  createRateLimiter,
  DEFAULT_AUTH_RATE_LIMITS,
  DEFAULT_RATE_LIMIT,
  type AuthRateLimits,
  type RateLimitOptions,
} from './middleware/rate-limit.js'
import { requestId } from './middleware/request-id.js'
import { createAuthRouter } from './routes/auth.js'
import { createHealthRouter } from './routes/health.js'
import type { Logger } from './utils/logger.js'

/** Maximum JSON request body. Raise per route only when a real endpoint needs it. */
export const JSON_BODY_LIMIT = '100kb'

export interface AppDependencies {
  config: Pick<AppConfig, 'corsOrigins'> & Partial<Pick<AppConfig, 'trustProxyHops' | 'proxySecret' | 'secureCookies'>>
  getDatabaseStatus: () => DatabaseStatus
  logger: Logger
  /** Per-IP request limit for /api (default DEFAULT_RATE_LIMIT). */
  rateLimit?: RateLimitOptions
  /** Registration and login limits (default DEFAULT_AUTH_RATE_LIMITS). */
  authRateLimits?: AuthRateLimits
}

/**
 * Builds the Express app without starting a server or touching the database,
 * so it can be tested in isolation. See server.ts for startup.
 */
export function createApp({
  config,
  getDatabaseStatus,
  logger,
  rateLimit = DEFAULT_RATE_LIMIT,
  authRateLimits = DEFAULT_AUTH_RATE_LIMITS,
}: AppDependencies): Express {
  const app = express()
  const allowedOrigins = new Set(config.corsOrigins)

  app.disable('x-powered-by')
  // Trust exactly the configured number of proxies (Render: 1), never `true`:
  // req.ip is then the address the nearest trusted proxy saw, not a client-supplied value.
  app.set('trust proxy', config.trustProxyHops ?? 0)
  app.use(requestId)
  app.use(
    helmet({
      // JSON-only API: responses never need to load anything or be framed.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
      },
    }),
  )
  app.use(
    cors({
      // Requests without an Origin header (curl, server-to-server) are not CORS requests.
      origin: (origin, callback) => callback(null, origin === undefined || allowedOrigins.has(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Accept', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      // Never credentialed: the app calls the API same-origin through the Cloudflare Worker,
      // so no cross-origin page may send or read the session cookie.
      credentials: false,
      maxAge: 600,
    }),
  )
  // Only the Worker may call the API in production (shared secret); also decides the client IP.
  app.use(proxyGate(config.proxySecret))
  // Before body parsing, so rejected clients cost as little as possible. Preflights are answered above.
  app.use(createRateLimiter(rateLimit))
  app.use(csrfProtection(config.corsOrigins))
  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }))
  // API responses may contain personal data: never store them in any cache.
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  app.use('/api', createHealthRouter(getDatabaseStatus))
  app.use(
    '/api',
    createAuthRouter({ secureCookies: config.secureCookies ?? false, getDatabaseStatus, rateLimits: authRateLimits }),
  )

  app.use(notFound)
  app.use(errorHandler(logger))

  return app
}
