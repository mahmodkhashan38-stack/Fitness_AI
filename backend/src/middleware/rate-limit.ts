import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
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
export function createRateLimiter({ windowMs, limit }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
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
