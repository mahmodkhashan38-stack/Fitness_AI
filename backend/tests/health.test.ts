import { afterEach, describe, expect, it } from 'vitest'
import type { DatabaseStatus } from '../src/database/connection.js'
import { startTestApp, type RunningServer } from './helpers.js'

let running: RunningServer | undefined
afterEach(async () => {
  await running?.close()
  running = undefined
})

describe('GET /api/health', () => {
  it('returns 200 and status ok when the database is connected', async () => {
    running = await startTestApp({ status: 'connected' })
    const response = await fetch(`${running.url}/api/health`)
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^application\/json/)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toEqual({
      status: 'ok',
      database: 'connected',
      timestamp: expect.any(String),
      uptimeSeconds: expect.any(Number),
    })
    expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false)
  })

  it.each<DatabaseStatus>(['disconnected', 'connecting', 'disconnecting'])(
    'returns 503 and status degraded when the database is %s',
    async (status) => {
      running = await startTestApp({ status })
      const response = await fetch(`${running.url}/api/health`)
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ status: 'degraded', database: status })
    },
  )

  it('exposes no server details', async () => {
    running = await startTestApp()
    const response = await fetch(`${running.url}/api/health`)
    const text = await response.text()
    expect(response.headers.get('x-powered-by')).toBeNull()
    expect(text).not.toMatch(/mongodb|version|host/i)
  })

  it('sets security headers (helmet) and a request id', async () => {
    running = await startTestApp()
    const response = await fetch(`${running.url}/api/health`)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reuses a well-formed incoming X-Request-Id and replaces a malformed one', async () => {
    running = await startTestApp()
    const kept = await fetch(`${running.url}/api/health`, { headers: { 'X-Request-Id': 'abc12345-trace' } })
    expect(kept.headers.get('x-request-id')).toBe('abc12345-trace')

    const replaced = await fetch(`${running.url}/api/health`, { headers: { 'X-Request-Id': '<script>' } })
    expect(replaced.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
  })
})
