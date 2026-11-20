import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/

/** Gives every request an id (reusing a well-formed incoming X-Request-Id) for log correlation. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('X-Request-Id')
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID()
  res.locals.requestId = id
  res.set('X-Request-Id', id)
  next()
}
