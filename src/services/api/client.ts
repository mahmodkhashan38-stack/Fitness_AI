import { getApiBaseUrl } from '@/services/api/config'
import { ApiError } from '@/services/api/errors'
import type {
  ApiClient,
  ApiClientOptions,
  ApiRequestOptions,
  FetchFunction,
  HttpMethod,
  QueryParams,
} from '@/services/api/types'

export const DEFAULT_TIMEOUT_MS = 15_000

/** Upper bound for text kept from a non-JSON error response. */
const MAX_ERROR_TEXT_LENGTH = 2_000

const defaultFetch: FetchFunction = (input, init) => globalThis.fetch(input, init)

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return mediaType === 'application/json' || mediaType.endsWith('+json')
}

function buildQueryString(query: QueryParams | undefined): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value as readonly (string | number | boolean)[]) params.append(key, String(item))
    } else {
      params.append(key, String(value))
    }
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

/** Rejects absolute or protocol-relative paths so requests (and future auth headers) never leave the API origin. */
function assertRelativePath(path: string, method: HttpMethod): void {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new ApiError({
      kind: 'config',
      method,
      message: `Invalid API path for ${method}: paths must start with a single "/" and be relative to the API base URL.`,
    })
  }
}

function resolveTimeout(value: number | undefined, fallback: number): number {
  const timeout = value ?? fallback
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 0
}

/** Reads an error response body for diagnostics: JSON if declared, otherwise trimmed text. */
function parseErrorBody(text: string, contentType: string | null): unknown {
  if (text === '') return undefined
  if (isJsonContentType(contentType)) {
    try {
      return JSON.parse(text) as unknown
    } catch {
      // fall through to text
    }
  }
  return text.length > MAX_ERROR_TEXT_LENGTH ? `${text.slice(0, MAX_ERROR_TEXT_LENGTH)}…` : text
}

function describe(method: HttpMethod, path: string): string {
  return `${method} ${path}`
}

/**
 * Creates a typed JSON API client on top of `fetch`.
 * No retries, no global auth: callers pass headers explicitly.
 */
export function createApiClient(clientOptions: ApiClientOptions): ApiClient {
  const fetchFn = clientOptions.fetch ?? defaultFetch
  const clientTimeout = clientOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: ApiRequestOptions<T> = {},
  ): Promise<T> {
    assertRelativePath(path, method)
    const baseUrl =
      typeof clientOptions.baseUrl === 'function' ? clientOptions.baseUrl() : clientOptions.baseUrl
    const url = `${baseUrl.replace(/\/+$/, '')}${path}${buildQueryString(options.query)}`

    const headers = new Headers({ Accept: 'application/json' })
    const hasBody = options.body !== undefined
    if (hasBody) headers.set('Content-Type', 'application/json')
    for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value)

    // Serialisation errors (e.g. circular data) are programming errors and propagate as-is.
    const body = hasBody ? JSON.stringify(options.body) : undefined

    const external = options.signal
    if (external?.aborted) {
      throw new ApiError({ kind: 'aborted', method, path, message: `${describe(method, path)} was cancelled.` })
    }

    // One controller, aborted by either the caller's signal or the timeout.
    const controller = new AbortController()
    let timedOut = false
    const onExternalAbort = () => controller.abort(external?.reason)
    external?.addEventListener('abort', onExternalAbort, { once: true })

    const timeoutMs = resolveTimeout(options.timeoutMs, clientTimeout)
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true
            controller.abort()
          }, timeoutMs)
        : undefined

    const abortError = (cause?: unknown): ApiError =>
      timedOut
        ? new ApiError({
            kind: 'timeout',
            method,
            path,
            message: `${describe(method, path)} timed out after ${timeoutMs} ms.`,
            cause,
          })
        : new ApiError({ kind: 'aborted', method, path, message: `${describe(method, path)} was cancelled.`, cause })

    try {
      let response: Response
      try {
        response = await fetchFn(url, { method, headers, body, signal: controller.signal })
      } catch (error) {
        if (controller.signal.aborted) throw abortError(error)
        throw new ApiError({
          kind: 'network',
          method,
          path,
          message: `${describe(method, path)} failed: the server could not be reached.`,
          cause: error,
        })
      }

      // The timeout also covers reading the body.
      let text: string
      try {
        text = response.status === 204 || response.status === 205 ? '' : await response.text()
      } catch (error) {
        if (controller.signal.aborted) throw abortError(error)
        throw new ApiError({
          kind: 'network',
          method,
          path,
          status: response.status,
          message: `${describe(method, path)} failed while reading the response.`,
          cause: error,
        })
      }

      const contentType = response.headers.get('Content-Type')

      if (!response.ok) {
        const statusText = response.statusText ? ` ${response.statusText}` : ''
        throw new ApiError({
          kind: 'http',
          method,
          path,
          status: response.status,
          body: parseErrorBody(text, contentType),
          message: `${describe(method, path)} failed with HTTP ${response.status}${statusText}.`,
        })
      }

      let data: unknown = undefined
      if (text !== '') {
        if (!isJsonContentType(contentType)) {
          throw new ApiError({
            kind: 'parse',
            method,
            path,
            status: response.status,
            message: `${describe(method, path)} returned ${contentType ?? 'no content type'} instead of JSON.`,
          })
        }
        try {
          data = JSON.parse(text) as unknown
        } catch (error) {
          throw new ApiError({
            kind: 'parse',
            method,
            path,
            status: response.status,
            message: `${describe(method, path)} returned malformed JSON.`,
            cause: error,
          })
        }
      }

      if (!options.parse) {
        // Unchecked: the caller's type parameter is trusted (see ResponseParser).
        return data as T
      }
      try {
        return options.parse(data)
      } catch (error) {
        throw new ApiError({
          kind: 'parse',
          method,
          path,
          status: response.status,
          message: `${describe(method, path)} returned data in an unexpected shape.`,
          cause: error,
        })
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      external?.removeEventListener('abort', onExternalAbort)
    }
  }

  return {
    request,
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    put: (path, options) => request('PUT', path, options),
    patch: (path, options) => request('PATCH', path, options),
    delete: (path, options) => request('DELETE', path, options),
  }
}

/**
 * Shared client for the Fitness AI API. The base URL is read from
 * VITE_API_BASE_URL on each request; if it is missing, requests reject with
 * `kind: 'config'` and the rest of the app keeps working.
 */
export const apiClient: ApiClient = createApiClient({ baseUrl: getApiBaseUrl })
