import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import type { AppConfig } from './config/env.js'
import type { DatabaseStatus } from './database/connection.js'
import { errorHandler, notFound } from './middleware/error-handler.js'
import { requestId } from './middleware/request-id.js'
import { createHealthRouter } from './routes/health.js'
import type { Logger } from './utils/logger.js'

/** Maximum JSON request body. Raise per route only when a real endpoint needs it. */
export const JSON_BODY_LIMIT = '100kb'

export interface AppDependencies {
  config: Pick<AppConfig, 'corsOrigins'>
  getDatabaseStatus: () => DatabaseStatus
  logger: Logger
}

/**
 * Builds the Express app without starting a server or touching the database,
 * so it can be tested in isolation. See server.ts for startup.
 */
export function createApp({ config, getDatabaseStatus, logger }: AppDependencies): Express {
  const app = express()
  const allowedOrigins = new Set(config.corsOrigins)

  app.disable('x-powered-by')
  app.use(requestId)
  app.use(helmet())
  app.use(
    cors({
      // Requests without an Origin header (curl, server-to-server) are not CORS requests.
      origin: (origin, callback) => callback(null, origin === undefined || allowedOrigins.has(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Accept', 'Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      credentials: false, // no cookies until the authentication design decides otherwise
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }))

  app.use('/api', createHealthRouter(getDatabaseStatus))

  app.use(notFound)
  app.use(errorHandler(logger))

  return app
}
