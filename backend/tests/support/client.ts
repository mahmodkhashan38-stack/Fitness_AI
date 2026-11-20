/** Default origin of the app in tests (one of the development defaults allowed for CSRF). */
export const APP_ORIGIN = 'http://localhost:5173'

export interface ClientResponse<T = unknown> {
  status: number
  headers: Headers
  body: T
  setCookies: string[]
}

/**
 * A minimal browser stand-in: keeps cookies between requests (like one browser profile)
 * and sends the app's Origin on every request, as browsers do for same-origin POSTs.
 */
export function createClient(baseUrl: string, options: { origin?: string | null; headers?: Record<string, string> } = {}) {
  const jar = new Map<string, string>()

  async function request<T = Record<string, unknown>>(
    method: string,
    path: string,
    init: { json?: unknown; headers?: Record<string, string>; rawBody?: string } = {},
  ): Promise<ClientResponse<T>> {
    const headers: Record<string, string> = { ...options.headers, ...init.headers }
    if (options.origin !== null && headers.Origin === undefined) headers.Origin = options.origin ?? APP_ORIGIN
    if (jar.size > 0 && headers.Cookie === undefined) headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
    let body: string | undefined = init.rawBody
    if (init.json !== undefined) {
      headers['Content-Type'] ??= 'application/json'
      body = JSON.stringify(init.json)
    }

    const response = await fetch(`${baseUrl}${path}`, { method, headers, body })
    const setCookies = response.headers.getSetCookie()
    for (const cookie of setCookies) {
      const [pair = '', ...attributes] = cookie.split(';')
      const index = pair.indexOf('=')
      const name = pair.slice(0, index).trim()
      const value = pair.slice(index + 1).trim()
      const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a) || /^\s*expires=thu, 01 jan 1970/i.test(a))
      if (expired || value === '') jar.delete(name)
      else jar.set(name, value)
    }
    const text = await response.text()
    return { status: response.status, headers: response.headers, body: (text ? JSON.parse(text) : undefined) as T, setCookies }
  }

  return {
    jar,
    get: <T = Record<string, unknown>>(path: string, headers?: Record<string, string>) => request<T>('GET', path, { headers }),
    post: <T = Record<string, unknown>>(path: string, json?: unknown, headers?: Record<string, string>) =>
      request<T>('POST', path, { json, headers }),
    patch: <T = Record<string, unknown>>(path: string, json?: unknown, headers?: Record<string, string>) =>
      request<T>('PATCH', path, { json, headers }),
    put: <T = Record<string, unknown>>(path: string, json?: unknown, headers?: Record<string, string>) =>
      request<T>('PUT', path, { json, headers }),
    delete: <T = Record<string, unknown>>(path: string, headers?: Record<string, string>) => request<T>('DELETE', path, { headers }),
    request,
  }
}

export type TestClient = ReturnType<typeof createClient>

/** A complete, valid fitness profile (FIT-12). */
export const validProfile = (overrides: Record<string, unknown> = {}) => ({
  sex: 'female',
  age: 29,
  heightCm: 168,
  weightKg: 61.5,
  goal: 'muscle_gain',
  trainingDaysPerWeek: 4,
  ...overrides,
})

export const validRegistration = (overrides: Record<string, unknown> = {}) => ({
  email: 'alex@example.com',
  password: 'correct horse battery staple',
  name: 'Alex',
  profile: validProfile(),
  ...overrides,
})
