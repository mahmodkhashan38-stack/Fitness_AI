import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JSON_BODY_LIMIT } from '../src/app.js'
import { errorHandler, notFound } from '../src/middleware/error-handler.js'
import { requestId } from '../src/middleware/request-id.js'
import { HttpError } from '../src/utils/http-error.js'
import type { Logger } from '../src/utils/logger.js'
import { listen, silentLogger, startTestApp, type RunningServer } from './helpers.js'

let running: RunningServer | undefined
afterEach(async () => {
  await running?.close()
  running = undefined
})

const errorShape = (code: string) => ({
  error: { code, message: expect.any(String), requestId: expect.any(String) },
})

describe('404 handling', () => {
  it.each(['/api/unknown', '/', '/api', '/api/health/extra'])('returns a JSON 404 for %s', async (path) => {
    running = await startTestApp()
    const response = await fetch(`${running.url}${path}`)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual(errorShape('NOT_FOUND'))
  })

  it('returns 404 for unsupported methods on existing paths', async () => {
    running = await startTestApp()
    const response = await fetch(`${running.url}/api/health`, { method: 'DELETE' })
    expect(response.status).toBe(404)
  })

  it('does not reflect the requested path (no injection into responses)', async () => {
    running = await startTestApp()
    const response = await fetch(`${running.url}/api/%3Cscript%3Ealert(1)%3C%2Fscript%3E`)
    expect(await response.text()).not.toContain('script')
  })

  it('includes the request id in the error body matching the header', async () => {
    running = await startTestApp()
    const response = await fetch(`${running.url}/missing`)
    const body = (await response.json()) as { error: { requestId: string } }
    expect(body.error.requestId).toBe(response.headers.get('x-request-id'))
  })
})

describe('request body handling', () => {
  const post = (url: string, body: string, contentType = 'application/json') =>
    fetch(`${url}/api/health`, { method: 'POST', headers: { 'Content-Type': contentType }, body })

  it('rejects malformed JSON with 400 INVALID_JSON and no parser details', async () => {
    running = await startTestApp()
    const response = await post(running.url, '{"broken":')
    const text = await response.text()
    expect(response.status).toBe(400)
    expect(JSON.parse(text)).toEqual(errorShape('INVALID_JSON'))
    expect(text).not.toMatch(/SyntaxError|Unexpected|at .*\.js/)
  })

  it('rejects non-object/array JSON roots in strict mode', async () => {
    running = await startTestApp()
    const response = await post(running.url, '"just a string"')
    expect(response.status).toBe(400)
  })

  it(`rejects bodies larger than ${JSON_BODY_LIMIT} with 413`, async () => {
    running = await startTestApp()
    const response = await post(running.url, JSON.stringify({ data: 'x'.repeat(101 * 1024) }))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual(errorShape('PAYLOAD_TOO_LARGE'))
  })

  it('accepts a body just under the limit (falls through to 404 because no POST route exists)', async () => {
    running = await startTestApp()
    const response = await post(running.url, JSON.stringify({ data: 'x'.repeat(99 * 1024) }))
    expect(response.status).toBe(404)
  })

  it('rejects unsupported content encodings with 415', async () => {
    running = await startTestApp()
    const response = await fetch(`${running.url}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'bogus' },
      body: '{}',
    })
    expect(response.status).toBe(415)
    expect(await response.json()).toEqual(errorShape('UNSUPPORTED_ENCODING'))
  })
})

describe('error handler', () => {
  function appThatThrows(error: unknown, logger: Logger = silentLogger) {
    const app = express()
    app.use(requestId)
    app.get('/boom', () => {
      throw error
    })
    app.get('/async-boom', async () => {
      await Promise.resolve()
      throw error
    })
    app.use(notFound)
    app.use(errorHandler(logger))
    return listen(app)
  }

  it('returns a generic 500 without stack trace or internal message', async () => {
    running = await appThatThrows(new Error('database password is hunter2'))
    for (const path of ['/boom', '/async-boom']) {
      const response = await fetch(`${running.url}${path}`)
      const text = await response.text()
      expect(response.status).toBe(500)
      expect(JSON.parse(text)).toEqual(errorShape('INTERNAL_ERROR'))
      expect(text).not.toMatch(/hunter2|stack|at .*\.ts/)
    }
  })

  it('handles non-Error throwables', async () => {
    running = await appThatThrows('a string')
    const response = await fetch(`${running.url}/boom`)
    expect(response.status).toBe(500)
  })

  it('returns status, code and message of an HttpError', async () => {
    running = await appThatThrows(new HttpError(422, 'VALIDATION_FAILED', 'Weight must be positive.'))
    const response = await fetch(`${running.url}/boom`)
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED', message: 'Weight must be positive.' } })
  })

  it('logs unexpected errors with request id and path but without the query string', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    running = await appThatThrows(new Error('kaboom'), logger)
    const response = await fetch(`${running.url}/boom?email=someone@example.com`)
    expect(logger.error).toHaveBeenCalledTimes(1)
    const [, fields] = logger.error.mock.calls[0] as [string, Record<string, unknown>]
    expect(fields).toMatchObject({ method: 'GET', path: '/boom', requestId: response.headers.get('x-request-id') })
    expect(JSON.stringify(fields)).not.toContain('someone@example.com')
  })

  it('does not log expected client errors', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    running = await appThatThrows(new HttpError(400, 'BAD', 'Bad.'), logger)
    await fetch(`${running.url}/boom`)
    expect(logger.error).not.toHaveBeenCalled()
  })
})
