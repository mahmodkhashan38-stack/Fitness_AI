import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_RATE_LIMIT } from '../src/middleware/rate-limit.js'
import { startTestApp, type RunningServer } from './helpers.js'

let running: RunningServer | undefined
afterEach(async () => {
  await running?.close()
  running = undefined
})

const SMALL = { windowMs: 60_000, limit: 3 }

const get = (path: string, headers: Record<string, string> = {}) => fetch(`${running!.url}${path}`, { headers })

describe('rate limiting', () => {
  it('uses a generous default that leaves room for health checks', () => {
    expect(DEFAULT_RATE_LIMIT).toEqual({ windowMs: 60_000, limit: 120 })
  })

  it('allows requests up to the limit and reports the remaining quota', async () => {
    running = await startTestApp({ rateLimit: SMALL })
    const first = await get('/api/health')
    expect(first.status).toBe(200)
    // IETF draft-8 headers: "<policy>"; r=<remaining>; t=<seconds until reset>
    expect(first.headers.get('ratelimit')).toMatch(/^"3-in-1min"; r=2; t=\d+$/)
    expect(first.headers.get('ratelimit-policy')).toMatch(/^"3-in-1min"; q=3; w=60/)
  })

  it('answers with a JSON 429 and Retry-After once the limit is exceeded', async () => {
    running = await startTestApp({ rateLimit: SMALL })
    for (let i = 0; i < 3; i++) expect((await get('/api/health')).status).toBe(200)

    const blocked = await get('/api/health')
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await blocked.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: expect.any(String), requestId: blocked.headers.get('x-request-id') },
    })
  })

  it('counts unknown routes too (404s cannot be used to bypass the limit)', async () => {
    running = await startTestApp({ rateLimit: SMALL })
    for (let i = 0; i < 3; i++) expect((await get(`/api/missing-${i}`)).status).toBe(404)
    expect((await get('/api/health')).status).toBe(429)
  })

  it('lets allowed browser origins read the 429 (CORS headers present)', async () => {
    running = await startTestApp({ rateLimit: { windowMs: 60_000, limit: 1 }, corsOrigins: ['https://app.example.com'] })
    await get('/api/health', { Origin: 'https://app.example.com' })
    const blocked = await get('/api/health', { Origin: 'https://app.example.com' })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
    expect(blocked.headers.get('access-control-expose-headers')).toContain('Retry-After')
  })

  describe('client identity', () => {
    it('ignores X-Forwarded-For when no proxy is trusted (TRUST_PROXY_HOPS=0)', async () => {
      running = await startTestApp({ rateLimit: SMALL, trustProxyHops: 0 })
      for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
        expect((await get('/api/health', { 'X-Forwarded-For': ip })).status).toBe(200)
      }
      // A fresh spoofed address does not create a fresh quota.
      expect((await get('/api/health', { 'X-Forwarded-For': '4.4.4.4' })).status).toBe(429)
    })

    it('behind one trusted proxy, uses the address the proxy appended, not client-supplied entries', async () => {
      running = await startTestApp({ rateLimit: SMALL, trustProxyHops: 1 })
      // Render appends the connecting IP to whatever the client sent: "<spoofed…>, <real client>".
      for (const spoofed of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
        expect((await get('/api/health', { 'X-Forwarded-For': `${spoofed}, 203.0.113.7` })).status).toBe(200)
      }
      expect((await get('/api/health', { 'X-Forwarded-For': '9.9.9.9, 203.0.113.7' })).status).toBe(429)

      // A different real client (different proxy-appended address) has its own quota.
      expect((await get('/api/health', { 'X-Forwarded-For': '198.51.100.20' })).status).toBe(200)
    })
  })
})
