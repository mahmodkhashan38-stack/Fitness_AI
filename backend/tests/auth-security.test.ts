import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CLIENT_IP_HEADER, PROXY_AUTH_HEADER } from '../src/middleware/proxy-gate.js'
import { UserModel } from '../src/models/user.js'
import type { DatabaseStatus } from '../src/database/connection.js'
import { createClient, validRegistration } from './support/client.js'
import { startTestDatabase } from './support/mongo.js'
import { startTestApp, type RunningServer } from './helpers.js'

let db: Awaited<ReturnType<typeof startTestDatabase>>
const servers: RunningServer[] = []

const generous = { windowMs: 60_000, limit: 10_000 }
const noAuthLimits = { register: generous, loginPerIp: generous, loginPerEmail: generous }

async function app(options: Parameters<typeof startTestApp>[0] = {}) {
  const server = await startTestApp({ authRateLimits: noAuthLimits, rateLimit: generous, ...options })
  servers.push(server)
  return server
}

beforeAll(async () => {
  db = await startTestDatabase()
})
afterAll(async () => {
  await db.stop()
})
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await db.clear()
})

type UserBody = { user: { id: string; email: string; name: string } }
type ErrorBody = { error: { code: string } }
const password = 'correct horse battery staple'

describe('cross-user data isolation', () => {
  it('derives the user only from the session; ids in requests are rejected or ignored', async () => {
    const { url } = await app()
    const alex = createClient(url)
    const sam = createClient(url)
    const alexId = (await alex.post<UserBody>('/api/auth/register', validRegistration())).body.user.id
    const samId = (await sam.post<UserBody>('/api/auth/register', validRegistration({ email: 'sam@example.com', name: 'Sam' }))).body.user.id

    expect((await alex.get<UserBody>('/api/auth/me')).body.user.id).toBe(alexId)
    expect((await sam.get<UserBody>('/api/auth/me')).body.user.id).toBe(samId)

    // No endpoint takes a user id: guessing paths gets 404, query parameters are ignored.
    expect((await alex.get(`/api/users/${samId}`)).status).toBe(404)
    expect((await alex.get(`/api/auth/me?id=${samId}&userId=${samId}`)).body).toMatchObject({ user: { id: alexId } })

    // Sending Sam's id in the body is refused and changes nothing.
    expect((await alex.patch('/api/users/me', { name: 'Hacked', id: samId })).status).toBe(400)
    expect((await alex.patch('/api/users/me', { name: 'Hacked', userId: samId })).status).toBe(400)
    expect((await alex.patch('/api/users/me', { name: 'Alex C' })).status).toBe(200)

    expect(await UserModel.findById(samId).lean()).toMatchObject({ name: 'Sam', email: 'sam@example.com' })
    expect(await UserModel.findById(alexId).lean()).toMatchObject({ name: 'Alex C' })
  })

  it('a session never resolves to another user, and logging one user out leaves the other signed in', async () => {
    const { url } = await app()
    const alex = createClient(url)
    const sam = createClient(url)
    await alex.post('/api/auth/register', validRegistration())
    await sam.post('/api/auth/register', validRegistration({ email: 'sam@example.com', name: 'Sam' }))

    await alex.post('/api/auth/logout')
    expect((await alex.get('/api/auth/me')).status).toBe(401)
    expect((await sam.get<UserBody>('/api/auth/me')).body.user.email).toBe('sam@example.com')
  })
})

describe('CSRF protection', () => {
  it.each([
    ['a foreign Origin', { Origin: 'https://evil.example.com' }],
    ['a look-alike Origin', { Origin: 'http://localhost:5173.evil.com' }],
    ['the "null" Origin (sandboxed iframes, file://)', { Origin: 'null' }],
    ['a cross-site fetch without Origin', { 'Sec-Fetch-Site': 'cross-site' }],
    ['a same-site (other subdomain) fetch without Origin', { 'Sec-Fetch-Site': 'same-site' }],
  ])('blocks state-changing requests with %s', async (_label, headers) => {
    const { url } = await app()
    const attacker = createClient(url, { origin: null })
    const response = await attacker.post<ErrorBody>('/api/auth/register', validRegistration(), headers)
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('CSRF_REJECTED')
    expect(await UserModel.countDocuments()).toBe(0)
  })

  it('blocks requests with neither Origin nor Sec-Fetch-Site (non-browser tools must identify the app origin)', async () => {
    const { url } = await app()
    expect((await createClient(url, { origin: null }).post('/api/auth/login', { email: 'a@b.co', password })).status).toBe(403)
  })

  it('allows same-origin requests identified only by Sec-Fetch-Site', async () => {
    const { url } = await app()
    const response = await createClient(url, { origin: null }).post('/api/auth/register', validRegistration(), { 'Sec-Fetch-Site': 'same-origin' })
    expect(response.status).toBe(201)
  })

  it('protects authenticated changes even when the victim’s cookie is present', async () => {
    const { url } = await app()
    const victim = createClient(url)
    await victim.post('/api/auth/register', validRegistration())
    // Simulates a browser that (unlike SameSite=Strict browsers) still attached the cookie cross-site.
    const response = await victim.patch('/api/users/me', { name: 'Pwned' }, { Origin: 'https://evil.example.com' })
    expect(response.status).toBe(403)
    expect((await victim.get<UserBody>('/api/auth/me')).body.user.name).toBe('Alex')

    expect((await victim.post('/api/auth/logout', undefined, { Origin: 'https://evil.example.com' })).status).toBe(403)
    expect((await victim.get('/api/auth/me')).status).toBe(200)
  })

  it.each(['application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'text/plain'])(
    'rejects %s bodies that an HTML form could send',
    async (contentType) => {
      const { url } = await app()
      const response = await createClient(url).request<ErrorBody>('POST', '/api/auth/register', {
        headers: { 'Content-Type': contentType },
        rawBody: 'email=a%40b.co&password=xxxxxxxxxxxx&name=A',
      })
      expect(response.status).toBe(415)
      expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
    },
  )

  it('does not apply to safe methods', async () => {
    const { url } = await app()
    expect((await createClient(url, { origin: 'https://evil.example.com' }).get('/api/health')).status).toBe(200)
  })
})

describe('CORS', () => {
  it('never allows credentialed cross-origin requests, even from the allowed origin', async () => {
    const { url } = await app({ corsOrigins: ['https://app.example.com'] })
    const preflight = await fetch(`${url}/api/auth/me`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com', 'Access-Control-Request-Method': 'GET' },
    })
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull()

    const evil = await fetch(`${url}/api/auth/me`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' },
    })
    expect(evil.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('is not what blocks attackers: a forged request from a non-browser is still refused by CSRF and session checks', async () => {
    const { url } = await app()
    // CORS headers mean nothing to curl-like clients; authorisation still requires a session.
    expect((await createClient(url, { origin: 'https://evil.example.com' }).get('/api/auth/me')).status).toBe(401)
  })
})

describe('proxy gate (production: API only reachable through the Cloudflare Worker)', () => {
  const secret = 'test-proxy-secret-0123456789abcdefghijkl'

  it('refuses direct requests without the shared secret, except the health check', async () => {
    const { url } = await app({ proxySecret: secret })
    const direct = createClient(url)
    expect((await direct.get<ErrorBody>('/api/auth/me')).body.error.code).toBe('FORBIDDEN')
    expect((await direct.post('/api/auth/register', validRegistration())).status).toBe(403)
    expect((await direct.get('/api/health')).status).toBe(200)
    expect((await direct.get('/api/health', { [PROXY_AUTH_HEADER]: 'wrong-secret' })).status).toBe(200)
    expect((await direct.get('/api/auth/me', { [PROXY_AUTH_HEADER]: 'wrong-secret-of-a-similar-length-xxxx' })).status).toBe(403)
    expect(await UserModel.countDocuments()).toBe(0)
  })

  it('exempts exactly GET /api/health, not look-alike paths or other methods', async () => {
    const { url } = await app({ proxySecret: secret })
    for (const [method, path] of [
      ['POST', '/api/health'],
      ['DELETE', '/api/health'],
      ['GET', '/api/health/'],
      ['GET', '/API/HEALTH'],
      ['GET', '/api/health/../auth/me'],
      ['GET', '/api/auth/me?/api/health'],
    ] as const) {
      const response = await fetch(`${url}${path}`, { method, headers: { Origin: 'http://localhost:5173' } })
      expect(response.status, `${method} ${path}`).toBe(403)
    }
  })

  it('accepts the secret only exactly (no prefix, suffix, case or list variants)', async () => {
    const { url } = await app({ proxySecret: secret })
    // (Leading/trailing spaces are not tested: HTTP strips them from header values, RFC 9110 §5.5.)
    for (const attempt of [secret.slice(0, -1), `${secret}x`, secret.toUpperCase(), `${secret}, ${secret}`, `${secret}${secret}`, '']) {
      const response = await fetch(`${url}/api/auth/me`, { headers: { [PROXY_AUTH_HEADER]: attempt } })
      expect(response.status, JSON.stringify(attempt)).toBe(403)
    }
    expect((await fetch(`${url}/api/auth/me`, { headers: { [PROXY_AUTH_HEADER]: secret } })).status).toBe(401)
  })

  it('accepts requests carrying the secret', async () => {
    const { url } = await app({ proxySecret: secret })
    const viaWorker = createClient(url, { headers: { [PROXY_AUTH_HEADER]: secret } })
    expect((await viaWorker.post('/api/auth/register', validRegistration())).status).toBe(201)
    expect((await viaWorker.get('/api/auth/me')).status).toBe(200)
  })
})

describe('rate limiting', () => {
  it('limits registrations per client IP', async () => {
    const { url } = await app({ authRateLimits: { ...noAuthLimits, register: { windowMs: 60_000, limit: 2 } } })
    expect((await createClient(url).post('/api/auth/register', validRegistration({ email: 'a1@example.com' }))).status).toBe(201)
    expect((await createClient(url).post('/api/auth/register', validRegistration({ email: 'a2@example.com' }))).status).toBe(201)
    const blocked = await createClient(url).post<ErrorBody>('/api/auth/register', validRegistration({ email: 'a3@example.com' }))
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('counts failed logins per IP; successful logins do not count; the block also stops correct passwords', async () => {
    const { url } = await app({ authRateLimits: { ...noAuthLimits, loginPerIp: { windowMs: 60_000, limit: 3 } } })
    await createClient(url).post('/api/auth/register', validRegistration())
    const login = (pw: string) => createClient(url).post('/api/auth/login', { email: 'alex@example.com', password: pw }).then((r) => r.status)

    for (let i = 0; i < 5; i++) expect(await login(password)).toBe(200)
    for (let i = 0; i < 3; i++) expect(await login('wrong password!')).toBe(401)
    expect(await login(password)).toBe(429)
  })

  it('counts failed logins per email across IPs (behind the Worker), without blocking other accounts', async () => {
    const secret = 'test-proxy-secret-0123456789abcdefghijkl'
    const { url } = await app({
      proxySecret: secret,
      authRateLimits: { ...noAuthLimits, loginPerEmail: { windowMs: 60_000, limit: 2 } },
    })
    const fromIp = (ip: string) => createClient(url, { headers: { [PROXY_AUTH_HEADER]: secret, [CLIENT_IP_HEADER]: ip } })
    await fromIp('198.51.100.1').post('/api/auth/register', validRegistration())
    await fromIp('198.51.100.1').post('/api/auth/register', validRegistration({ email: 'sam@example.com' }))

    expect((await fromIp('203.0.113.1').post('/api/auth/login', { email: 'alex@example.com', password: 'nope nope nope' })).status).toBe(401)
    expect((await fromIp('203.0.113.2').post('/api/auth/login', { email: 'ALEX@example.com', password: 'nope nope nope' })).status).toBe(401)
    expect((await fromIp('203.0.113.3').post('/api/auth/login', { email: 'alex@example.com', password })).status).toBe(429)
    expect((await fromIp('203.0.113.3').post('/api/auth/login', { email: 'sam@example.com', password })).status).toBe(200)
  })

  it('uses the Worker-supplied client IP only when the shared secret is valid', async () => {
    const secret = 'test-proxy-secret-0123456789abcdefghijkl'
    const limits = { ...noAuthLimits, register: { windowMs: 60_000, limit: 1 } }
    const gated = await app({ proxySecret: secret, authRateLimits: limits })
    const register = (url: string, headers: Record<string, string>, i: number) =>
      createClient(url, { headers }).post('/api/auth/register', validRegistration({ email: `u${i}@example.com` })).then((r) => r.status)

    // Behind the Worker, different visitors have separate quotas.
    expect(await register(gated.url, { [PROXY_AUTH_HEADER]: secret, [CLIENT_IP_HEADER]: '198.51.100.1' }, 1)).toBe(201)
    expect(await register(gated.url, { [PROXY_AUTH_HEADER]: secret, [CLIENT_IP_HEADER]: '198.51.100.2' }, 2)).toBe(201)
    expect(await register(gated.url, { [PROXY_AUTH_HEADER]: secret, [CLIENT_IP_HEADER]: '198.51.100.2' }, 3)).toBe(429)

    // Without a gate (development), a client-sent IP header is ignored: one quota for the real socket address.
    const open = await app({ authRateLimits: limits })
    expect(await register(open.url, { [CLIENT_IP_HEADER]: '198.51.100.7' }, 4)).toBe(201)
    expect(await register(open.url, { [CLIENT_IP_HEADER]: '198.51.100.8' }, 5)).toBe(429)
  })
})

describe('client IP from the Worker', () => {
  const secret = 'test-proxy-secret-0123456789abcdefghijkl'

  it.each([['not-an-ip'], ['1.2.3.4, 5.6.7.8'], ['999.1.1.1'], ['']])('ignores a malformed value (%j) and falls back to the connection address', async (value) => {
    const limits = { ...noAuthLimits, register: { windowMs: 60_000, limit: 1 } }
    const { url } = await app({ proxySecret: secret, authRateLimits: limits })
    const register = (ip: string, i: number) =>
      createClient(url, { headers: { [PROXY_AUTH_HEADER]: secret, [CLIENT_IP_HEADER]: ip } })
        .post('/api/auth/register', validRegistration({ email: `v${i}@example.com` }))
        .then((r) => r.status)
    expect(await register(value, 1)).toBe(201)
    // Same fallback identity (the socket address), so the quota is shared: no fresh bucket per bogus value.
    expect(await register(`${value} `, 2)).toBe(429)
  })
})

describe('database availability (Render cold start, Atlas reconnect)', () => {
  it('answers auth requests with 503 + Retry-After while MongoDB is not connected', async () => {
    let status: DatabaseStatus = 'connecting'
    const { url } = await app({ getDatabaseStatus: () => status })
    const response = await createClient(url).post<ErrorBody>('/api/auth/login', { email: 'alex@example.com', password })
    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE')
    expect(response.headers.get('retry-after')).toBe('5')
    expect((await createClient(url).get('/api/auth/me')).status).toBe(503)

    status = 'connected'
    expect((await createClient(url).post('/api/auth/register', validRegistration())).status).toBe(201)
  })
})

describe('logging', () => {
  it('never logs passwords, session tokens or cookies during auth flows and errors', async () => {
    const lines: string[] = []
    const capture = (...args: unknown[]) => lines.push(JSON.stringify(args))
    const logger = { debug: capture, info: capture, warn: capture, error: capture }
    const { url } = await app({ logger })
    const c = createClient(url)
    await c.post('/api/auth/register', validRegistration())
    const token = c.jar.get('fa_session')!
    await c.post('/api/auth/login', { email: 'alex@example.com', password: 'wrong password!' })

    // Force an unexpected error inside an authenticated request.
    const spy = vi.spyOn(mongoose.Model, 'findOneAndUpdate').mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect((await c.patch('/api/users/me', { name: 'X' })).status).toBe(500)
    spy.mockRestore()

    expect(lines.length).toBeGreaterThan(0) // the 500 was logged
    const all = lines.join('\n')
    for (const secret of [password, 'wrong password!', token]) expect(all).not.toContain(secret)
    expect(all).not.toMatch(/cookie|fa_session/i)
  })
})
