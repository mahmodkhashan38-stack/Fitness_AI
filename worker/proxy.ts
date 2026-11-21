/**
 * API proxy logic of the Cloudflare Worker in front of the Fitness AI app (FIT-11).
 * The entry module (worker/index.ts) may only export handlers: workerd treats every named
 * export of the entry module as an entrypoint, so constants and helpers live here.
 *
 * Static files are served by Workers static assets without invoking this script
 * (wrangler.jsonc: run_worker_first only for /api/*). This script forwards /api/* to the
 * Render API, so the browser sees one origin: the session cookie is first-party
 * (__Host-, SameSite=Strict) and works in Safari, which blocks third-party cookies.
 *
 * The Worker proves itself to the API with a shared secret and passes the visitor's IP
 * for rate limiting. Clients can't forge either: both headers are always overwritten.
 */

export interface Env {
  /** Origin of the Render API, e.g. https://fitness-ai-api.onrender.com (wrangler.jsonc vars). */
  API_ORIGIN?: string
  /** Shared secret, also set as PROXY_SECRET on Render (`wrangler secret put PROXY_SECRET`). */
  PROXY_SECRET?: string
}

export const PROXY_AUTH_HEADER = 'X-Fitness-Proxy-Auth'
export const CLIENT_IP_HEADER = 'X-Fitness-Client-Ip'
/** The API itself rejects bodies over 100 KB; refuse anything far larger before reading it. */
export const MAX_BODY_BYTES = 1_000_000

/** Headers a client must not be able to set on the forwarded request. */
const STRIPPED_REQUEST_HEADERS = [
  'host',
  PROXY_AUTH_HEADER,
  CLIENT_IP_HEADER,
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'forwarded',
  'true-client-ip',
]

function errorResponse(status: number, code: string, message: string, retryAfterSeconds?: number): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  if (retryAfterSeconds !== undefined) headers.set('Retry-After', String(retryAfterSeconds))
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers })
}

/** Bounds for the Retry-After sent with UPSTREAM_UNAVAILABLE (seconds). */
export const UPSTREAM_RETRY_AFTER = { default: 30, min: 1, max: 300 } as const

function isJsonResponse(response: Response): boolean {
  const type = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()
  return type === 'application/json' || (type?.endsWith('+json') ?? false)
}

/** The upstream Retry-After in whole seconds (delta-seconds only), bounded; a default otherwise. */
function upstreamRetryAfter(response: Response): number {
  const value = response.headers.get('Retry-After')?.trim()
  if (value && /^\d{1,6}$/.test(value)) {
    return Math.min(UPSTREAM_RETRY_AFTER.max, Math.max(UPSTREAM_RETRY_AFTER.min, Number(value)))
  }
  return UPSTREAM_RETRY_AFTER.default
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

/**
 * The API origin must use HTTPS: the shared secret and session cookies travel on this hop.
 * Plain http is only accepted for local development (wrangler dev against a local API).
 */
export function parseApiOrigin(value: string | undefined): URL | null {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null
  return new URL(url.origin)
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (!isApiPath(url.pathname)) return errorResponse(404, 'NOT_FOUND', 'The requested resource was not found.')

  const apiOrigin = parseApiOrigin(env.API_ORIGIN)
  if (!apiOrigin || !env.PROXY_SECRET) {
    // Misconfiguration: never forward without the secret, or over plain http.
    return errorResponse(500, 'PROXY_NOT_CONFIGURED', 'The service is not configured correctly.')
  }

  // Path and query only: the origin always comes from configuration, never from the request.
  const target = new URL(url.pathname + url.search, apiOrigin)
  if (target.origin !== apiOrigin.origin) return errorResponse(400, 'BAD_REQUEST', 'The request is invalid.')
  const headers = new Headers(request.headers)
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name)
  headers.set(PROXY_AUTH_HEADER, env.PROXY_SECRET)
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp)

  let body: ArrayBuffer | undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.')
    }
    body = await request.arrayBuffer()
    if (body.byteLength > MAX_BODY_BYTES) return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.')
  }

  let upstream: Response
  try {
    upstream = await fetch(target, { method: request.method, headers, body, redirect: 'manual' })
  } catch {
    // Render unreachable (e.g. still waking from a cold start). The app retries on 502/503.
    return errorResponse(502, 'UPSTREAM_UNAVAILABLE', 'Fitness AI is starting up. Please try again in a moment.', 5)
  }

  // The API always answers with JSON. A non-JSON error comes from something in front of it, e.g. a
  // Cloudflare bot challenge or block page on the Render hostname (HTTP 403/429), or Render's own
  // "waking up" / bad gateway pages. A server-side proxy can't pass a challenge, and the app can't
  // use the HTML, so answer with the app's structured "temporarily unavailable" error instead.
  // Its cookies (e.g. __cf_bm for onrender.com) are dropped rather than set on the app's origin.
  if (!upstream.ok && !isJsonResponse(upstream)) {
    await upstream.body?.cancel()
    console.warn(
      JSON.stringify({
        event: 'upstream_non_api_error',
        status: upstream.status,
        cfRay: upstream.headers.get('cf-ray'),
        path: url.pathname,
      }),
    )
    return errorResponse(
      503,
      'UPSTREAM_UNAVAILABLE',
      'Fitness AI is temporarily unavailable. Please try again in a moment.',
      upstreamRetryAfter(upstream),
    )
  }

  // API responses (including its JSON 429 with RateLimit and Retry-After headers): status,
  // headers (including Set-Cookie) and body pass through unchanged.
  const response = new Response(upstream.body, upstream)
  if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'no-store')
  return response
}
