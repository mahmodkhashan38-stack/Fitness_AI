import { createHash } from 'node:crypto'
import type { Request, RequestHandler, Response } from 'express'
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit'
import { normaliseEmail } from '../auth/validation.js'
import type { ErrorResponseBody } from '../utils/http-error.js'

export interface RateLimitOptions {
  /** Length of the counting window in milliseconds. */
  windowMs: number
  /** Requests allowed per client IP in one window. */
  limit: number
}

/**
 * Default API limit per client IP: generous for real use (and Render's health checks),
 * low enough to blunt scripted abuse. Tighter per-route limits belong on future
 * sensitive endpoints (e.g. login) when they exist.
 */
export const DEFAULT_RATE_LIMIT: RateLimitOptions = { windowMs: 60_000, limit: 120 }

/**
 * Per-IP rate limiter (in-memory: correct for a single instance; a shared store is needed
 * once the API runs on several instances). The client IP is req.ip, which depends on
 * Express "trust proxy" (TRUST_PROXY_HOPS): only proxy-appended X-Forwarded-For entries
 * are trusted, so clients cannot pick their own identity by sending the header.
 */
/** Per-route limits for authentication (see docs/fit-11-auth-qa-report.md). */
export interface AuthRateLimits {
  /** Registrations per client IP (all attempts count). */
  register: RateLimitOptions
  /** Failed logins per client IP. */
  loginPerIp: RateLimitOptions
  /** Failed logins per email address, from any IP (slows distributed guessing against one account). */
  loginPerEmail: RateLimitOptions
}

export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimits = {
  register: { windowMs: 60 * 60_000, limit: 5 },
  loginPerIp: { windowMs: 15 * 60_000, limit: 10 },
  loginPerEmail: { windowMs: 15 * 60_000, limit: 5 },
}

/**
 * The client IP decided by proxyGate (Worker-supplied when authenticated, else req.ip),
 * grouped by /56 for IPv6 so one user can't rotate through their own address block.
 */
function clientKey(req: Request, res: Response): string {
  const ip = typeof res.locals.clientIp === 'string' ? res.locals.clientIp : (req.ip ?? 'unknown')
  return ipKeyGenerator(ip)
}

function emailKey(req: Request, res: Response): string {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email
  if (typeof email !== 'string') return `ip:${clientKey(req, res)}`
  // Hashed so email addresses never sit in memory as rate-limit keys.
  return `email:${createHash('sha256').update(normaliseEmail(email)).digest('hex')}`
}

export function createRateLimiter(
  { windowMs, limit }: RateLimitOptions,
  overrides: Partial<Pick<Options, 'keyGenerator' | 'skipSuccessfulRequests'>> = {},
): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator: clientKey,
    ...overrides,
    standardHeaders: 'draft-8', // RateLimit / RateLimit-Policy response headers
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined
      const body: ErrorResponseBody = {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment and try again.',
          ...(requestId ? { requestId } : {}),
        },
      }
      res.status(options.statusCode).json(body)
    },
  })
}

export function createAuthRateLimiters(limits: AuthRateLimits) {
  return {
    register: createRateLimiter(limits.register),
    // Only failed attempts count, so a user who logs in successfully isn't locked out.
    loginPerIp: createRateLimiter(limits.loginPerIp, { skipSuccessfulRequests: true }),
    loginPerEmail: createRateLimiter(limits.loginPerEmail, { skipSuccessfulRequests: true, keyGenerator: emailKey }),
  }
}
