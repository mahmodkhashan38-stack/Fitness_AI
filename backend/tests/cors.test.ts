import { afterEach, describe, expect, it } from 'vitest'
import { startTestApp, type RunningServer } from './helpers.js'

let running: RunningServer | undefined
afterEach(async () => {
  await running?.close()
  running = undefined
})

const ALLOWED = 'https://app.example.com'

describe('CORS', () => {
  it('allows a listed origin and exposes X-Request-Id', async () => {
    running = await startTestApp({ corsOrigins: [ALLOWED] })
    const response = await fetch(`${running.url}/api/health`, { headers: { Origin: ALLOWED } })
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED)
    expect(response.headers.get('access-control-expose-headers')).toBe('X-Request-Id,RateLimit,RateLimit-Policy,Retry-After')
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    expect(response.headers.get('vary')).toMatch(/Origin/)
  })

  it.each(['https://evil.example.com', 'https://app.example.com.evil.com', 'http://app.example.com', 'null'])(
    'does not allow unlisted origin %s',
    async (origin) => {
      running = await startTestApp({ corsOrigins: [ALLOWED] })
      const response = await fetch(`${running.url}/api/health`, { headers: { Origin: origin } })
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    },
  )

  it('never responds with a wildcard origin', async () => {
    running = await startTestApp({ corsOrigins: [ALLOWED] })
    const response = await fetch(`${running.url}/api/health`)
    expect(response.headers.get('access-control-allow-origin')).not.toBe('*')
  })

  it('answers preflight requests from an allowed origin', async () => {
    running = await startTestApp({ corsOrigins: [ALLOWED] })
    const response = await fetch(`${running.url}/api/health`, {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED)
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type')
    expect(response.headers.get('access-control-max-age')).toBe('600')
  })

  it('gives no CORS approval to preflight requests from other origins', async () => {
    running = await startTestApp({ corsOrigins: [ALLOWED] })
    const response = await fetch(`${running.url}/api/health`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' },
    })
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('access-control-allow-methods')).toBeNull()
  })

  it('supports multiple allowed origins', async () => {
    running = await startTestApp({ corsOrigins: [ALLOWED, 'http://localhost:5173'] })
    const response = await fetch(`${running.url}/api/health`, { headers: { Origin: 'http://localhost:5173' } })
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })
})
