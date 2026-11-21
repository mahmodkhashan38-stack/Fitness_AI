import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index.ts'
import { CLIENT_IP_HEADER, MAX_BODY_BYTES, parseApiOrigin, PROXY_AUTH_HEADER, type Env } from './proxy.ts'

const env: Env = { API_ORIGIN: 'https://api.example.onrender.com', PROXY_SECRET: 'secret-0123456789abcdefghijklmnopqrstuv' }

function mockUpstream(response: Response = new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } })) {
  const calls: Request[] = []
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(new Request(input, init))
    return response
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
}

afterEach(() => vi.unstubAllGlobals())

describe('API proxy Worker', () => {
  it('forwards /api requests to the API origin with path and query', async () => {
    const { calls } = mockUpstream()
    const response = await worker.fetch(new Request('https://fitness-ai.example.workers.dev/api/auth/me?x=1'), env)
    expect(response.status).toBe(200)
    expect(calls[0]!.url).toBe('https://api.example.onrender.com/api/auth/me?x=1')
  })

  it('adds the shared secret and the visitor IP, overwriting anything the client sent', async () => {
    const { calls } = mockUpstream()
    await worker.fetch(
      new Request('https://app.example/api/auth/me', {
        headers: {
          [PROXY_AUTH_HEADER]: 'forged',
          [CLIENT_IP_HEADER]: '1.2.3.4',
          'X-Forwarded-For': '5.6.7.8',
          'X-Real-IP': '9.9.9.9',
          'CF-Connecting-IP': '203.0.113.9',
        },
      }),
      env,
    )
    const forwarded = calls[0]!.headers
    expect(forwarded.get(PROXY_AUTH_HEADER)).toBe(env.PROXY_SECRET)
    expect(forwarded.get(CLIENT_IP_HEADER)).toBe('203.0.113.9')
    expect(forwarded.get('x-forwarded-for')).toBeNull()
    expect(forwarded.get('x-real-ip')).toBeNull()
  })

  it('drops a client-sent IP header when Cloudflare provides none', async () => {
    const { calls } = mockUpstream()
    await worker.fetch(new Request('https://app.example/api/health', { headers: { [CLIENT_IP_HEADER]: '1.2.3.4' } }), env)
    expect(calls[0]!.headers.get(CLIENT_IP_HEADER)).toBeNull()
  })

  it('forwards cookies, Origin and the JSON body, and returns Set-Cookie unchanged', async () => {
    const upstream = new Response(null, { status: 201, headers: { 'Set-Cookie': '__Host-fa_session=abc; Path=/; HttpOnly; Secure; SameSite=Strict' } })
    const { calls } = mockUpstream(upstream)
    const response = await worker.fetch(
      new Request('https://app.example/api/auth/login', {
        method: 'POST',
        headers: { Cookie: '__Host-fa_session=old', Origin: 'https://app.example', 'Content-Type': 'application/json' },
        body: '{"email":"a@b.co","password":"x"}',
      }),
      env,
    )
    const forwarded = calls[0]!
    expect(forwarded.method).toBe('POST')
    expect(forwarded.headers.get('cookie')).toBe('__Host-fa_session=old')
    expect(forwarded.headers.get('origin')).toBe('https://app.example')
    expect(await forwarded.text()).toBe('{"email":"a@b.co","password":"x"}')
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toBe('__Host-fa_session=abc; Path=/; HttpOnly; Secure; SameSite=Strict')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('does not follow redirects from the API', async () => {
    const { fetchMock } = mockUpstream()
    await worker.fetch(new Request('https://app.example/api/health'), env)
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' })
  })

  it('answers 502 + Retry-After when the API is unreachable (cold start)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('connect timeout'))))
    const response = await worker.fetch(new Request('https://app.example/api/auth/me'), env)
    expect(response.status).toBe(502)
    expect(response.headers.get('retry-after')).toBe('5')
    expect(await response.json()).toEqual({ error: { code: 'UPSTREAM_UNAVAILABLE', message: expect.any(String) } })
  })

  it('refuses oversized bodies without reading them', async () => {
    const { fetchMock } = mockUpstream()
    const response = await worker.fetch(
      new Request('https://app.example/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Length': String(MAX_BODY_BYTES + 1), 'Content-Type': 'application/json' },
        body: 'x',
      }),
      env,
    )
    expect(response.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never forwards when misconfigured, and only handles /api paths', async () => {
    const { fetchMock } = mockUpstream()
    expect((await worker.fetch(new Request('https://app.example/api/auth/me'), { API_ORIGIN: env.API_ORIGIN })).status).toBe(500)
    expect((await worker.fetch(new Request('https://app.example/apiary'), env)).status).toBe(404)
    expect((await worker.fetch(new Request('https://app.example/settings'), env)).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cannot be pointed at another host through the path', async () => {
    const { calls } = mockUpstream()
    await worker.fetch(new Request('https://app.example/api//evil.example.com/x'), env)
    expect(new URL(calls[0]!.url).origin).toBe('https://api.example.onrender.com')
  })

  it('keeps every normalised or encoded path on the API origin', async () => {
    const { calls } = mockUpstream()
    for (const path of ['/api/%2e%2e/%2e%2e/admin', '/api/..%2f..%2fx', '/api/@evil.example.com/x', '/api/\\evil.example.com']) {
      await worker.fetch(new Request(`https://app.example${path}`), env)
    }
    for (const call of calls) expect(new URL(call.url).origin).toBe('https://api.example.onrender.com')
  })

  it('collapses duplicate forged headers: the client cannot add a second secret or IP', async () => {
    const { calls } = mockUpstream()
    const headers = new Headers({ 'CF-Connecting-IP': '203.0.113.9' })
    headers.append(PROXY_AUTH_HEADER, 'forged-1')
    headers.append(PROXY_AUTH_HEADER.toLowerCase(), 'forged-2')
    headers.append(CLIENT_IP_HEADER, '1.1.1.1')
    await worker.fetch(new Request('https://app.example/api/auth/me', { headers }), env)
    expect(calls[0]!.headers.get(PROXY_AUTH_HEADER)).toBe(env.PROXY_SECRET)
    expect(calls[0]!.headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.9')
  })

  it('passes several Set-Cookie headers through intact', async () => {
    const upstream = new Response(null, { status: 200 })
    upstream.headers.append('Set-Cookie', '__Host-fa_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict')
    upstream.headers.append('Set-Cookie', '__Host-fa_session=new; Path=/; HttpOnly; Secure; SameSite=Strict')
    mockUpstream(upstream)
    const response = await worker.fetch(new Request('https://app.example/api/auth/login', { method: 'POST', body: '{}' }), env)
    expect(response.headers.getSetCookie()).toHaveLength(2)
  })

  it('never sends the secret over plain http to a remote API', async () => {
    const { fetchMock } = mockUpstream()
    const response = await worker.fetch(new Request('https://app.example/api/auth/me'), { ...env, API_ORIGIN: 'http://fitness-ai-api.onrender.com' })
    expect(response.status).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('parseApiOrigin', () => {
  it.each([
    ['https://fitness-ai-api.onrender.com', 'https://fitness-ai-api.onrender.com'],
    ['https://fitness-ai-api.onrender.com/api/ignored?x', 'https://fitness-ai-api.onrender.com'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://127.0.0.1:3000', 'http://127.0.0.1:3000'],
  ])('accepts %s', (input, origin) => {
    expect(parseApiOrigin(input)?.origin).toBe(origin)
  })

  it.each([undefined, '', 'not a url', 'http://fitness-ai-api.onrender.com', 'ftp://x.example.com', 'http://localhost.evil.com'])('rejects %j', (input) => {
    expect(parseApiOrigin(input)).toBeNull()
  })
})

describe('upstream responses that are not from the API (FIT-11 hotfix)', () => {
  const challenge = (status: number, headers: Record<string, string> = {}) =>
    new Response('<!DOCTYPE html><title>Just a moment...</title><script>window._cf_chl_opt={}</script>', {
      status,
      headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Set-Cookie': '__cf_bm=abc; Domain=onrender.com; Path=/', 'CF-Ray': 'a5dec00d4d321d8c-FRA', ...headers },
    })

  it.each([429, 403, 503, 502])('turns an HTML %i (e.g. a Cloudflare challenge) into JSON 503 UPSTREAM_UNAVAILABLE', async (status) => {
    mockUpstream(challenge(status))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const response = await worker.fetch(new Request('https://app.example/api/auth/me'), env)
    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('retry-after')).toBe('30')
    expect(await response.json()).toEqual({
      error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Fitness AI is temporarily unavailable. Please try again in a moment.' },
    })
    // The challenge's cookies for onrender.com are never set on the app's origin.
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(JSON.parse(warn.mock.calls[0]![0] as string)).toEqual({
      event: 'upstream_non_api_error',
      status,
      cfRay: 'a5dec00d4d321d8c-FRA',
      path: '/api/auth/me',
    })
    warn.mockRestore()
  })

  it.each([
    ['120', '120'],
    ['0', '1'],
    ['99999', '300'],
    ['Wed, 21 Oct 2026 07:28:00 GMT', '30'],
    ['soon', '30'],
  ])('keeps a sensible upstream Retry-After (%s → %s)', async (value, expected) => {
    mockUpstream(challenge(503, { 'Retry-After': value }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const response = await worker.fetch(new Request('https://app.example/api/health'), env)
    expect(response.headers.get('retry-after')).toBe(expected)
    vi.restoreAllMocks()
  })

  it('passes the API’s own JSON 429 through unchanged, with its rate-limit headers', async () => {
    const body = { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.', requestId: 'r1' } }
    mockUpstream(
      Response.json(body, {
        status: 429,
        headers: {
          'Retry-After': '42',
          RateLimit: '"10-in-15min"; r=0; t=42',
          'RateLimit-Policy': '"10-in-15min"; q=10; w=900; pk=:abc:',
          'X-Request-Id': 'r1',
        },
      }),
    )
    const response = await worker.fetch(new Request('https://app.example/api/auth/login', { method: 'POST', body: '{}' }), env)
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('42')
    expect(response.headers.get('ratelimit')).toBe('"10-in-15min"; r=0; t=42')
    expect(response.headers.get('ratelimit-policy')).toBe('"10-in-15min"; q=10; w=900; pk=:abc:')
    expect(response.headers.get('x-request-id')).toBe('r1')
    expect(await response.json()).toEqual(body)
  })

  it.each([
    [401, { error: { code: 'UNAUTHENTICATED', message: 'Please log in to continue.' } }],
    [403, { error: { code: 'CSRF_REJECTED', message: 'x' } }],
    [503, { error: { code: 'DATABASE_UNAVAILABLE', message: 'x' } }],
  ])('passes other API JSON errors through unchanged (%i)', async (status, body) => {
    mockUpstream(Response.json(body, { status, headers: { 'Set-Cookie': '__Host-fa_session=; Max-Age=0; Path=/; Secure' } }))
    const response = await worker.fetch(new Request('https://app.example/api/auth/me'), env)
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual(body)
    expect(response.headers.get('set-cookie')).toContain('__Host-fa_session')
  })

  it('passes successful responses through even if they are not JSON (e.g. 204)', async () => {
    mockUpstream(new Response(null, { status: 204 }))
    const response = await worker.fetch(new Request('https://app.example/api/auth/logout', { method: 'POST' }), env)
    expect(response.status).toBe(204)
  })
})
