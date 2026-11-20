import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from '@/services/api/client'
import { isApiError } from '@/services/api/errors'
import { fetchApiHealth, parseApiHealth, type ApiHealth } from '@/services/api/health'
import type { FetchFunction } from '@/services/api/types'

const healthy: ApiHealth = { status: 'ok', database: 'connected', timestamp: '2026-11-20T10:00:00.000Z', uptimeSeconds: 42 }
const degraded: ApiHealth = { ...healthy, status: 'degraded', database: 'disconnected' }

const respond = (body: unknown, status = 200, contentType = 'application/json') =>
  vi.fn<FetchFunction>(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': contentType } }))

const clientWith = (fetch: FetchFunction) => createApiClient({ baseUrl: '/api', fetch })

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected rejection')
}

describe('parseApiHealth', () => {
  it('accepts a valid body and drops unknown fields', () => {
    expect(parseApiHealth({ ...healthy, extra: 'x' })).toEqual(healthy)
  })

  it.each([
    null,
    [],
    'ok',
    { ...healthy, status: 'fine' },
    { ...healthy, database: 'up' },
    { ...healthy, timestamp: 'yesterday' },
    { ...healthy, timestamp: 1 },
    { ...healthy, uptimeSeconds: '42' },
    { ...healthy, uptimeSeconds: Number.NaN },
  ])('rejects %j', (value) => {
    expect(() => parseApiHealth(value)).toThrow(TypeError)
  })
})

describe('fetchApiHealth', () => {
  it('GETs <base>/health with a 5 s timeout and returns the parsed body', async () => {
    const fetch = respond(healthy)
    await expect(fetchApiHealth({ client: clientWith(fetch) })).resolves.toEqual(healthy)
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET' }))
  })

  it('resolves with the degraded body on 503 (API up, database down)', async () => {
    await expect(fetchApiHealth({ client: clientWith(respond(degraded, 503)) })).resolves.toEqual(degraded)
  })

  it('reports a malformed 503 body as a parse error', async () => {
    const error = await errorOf(fetchApiHealth({ client: clientWith(respond({ error: { code: 'X' } }, 503)) }))
    expect(isApiError(error) && error.kind).toBe('parse')
  })

  it('rethrows other HTTP errors unchanged', async () => {
    const error = await errorOf(fetchApiHealth({ client: clientWith(respond({ error: { code: 'NOT_FOUND' } }, 404)) }))
    expect(isApiError(error) && [error.kind, error.status]).toEqual(['http', 404])
  })

  it('reports an unexpected 200 body as a parse error', async () => {
    const error = await errorOf(fetchApiHealth({ client: clientWith(respond({ status: 'ok' })) }))
    expect(isApiError(error) && error.kind).toBe('parse')
  })

  it('reports HTML (e.g. SPA fallback when the proxy is missing) as a parse error', async () => {
    const error = await errorOf(fetchApiHealth({ client: clientWith(respond('<!doctype html>', 200, 'text/html')) }))
    expect(isApiError(error) && error.kind).toBe('parse')
  })

  it('passes the abort signal through', async () => {
    const controller = new AbortController()
    const fetch = vi.fn<FetchFunction>(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
        ),
    )
    const pending = errorOf(fetchApiHealth({ client: clientWith(fetch), signal: controller.signal }))
    controller.abort()
    const error = await pending
    expect(isApiError(error) && error.kind).toBe('aborted')
  })
})
