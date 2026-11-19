export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** A single query value. `null`/`undefined` are omitted; arrays repeat the key (`?tag=a&tag=b`). */
export type QueryPrimitive = string | number | boolean
export type QueryValue = QueryPrimitive | readonly QueryPrimitive[] | null | undefined
export type QueryParams = Readonly<Record<string, QueryValue>>

/**
 * Turns unknown response data into a trusted `T`, throwing if it doesn't match.
 * Without a parser, the response type parameter is an unchecked assumption.
 */
export type ResponseParser<T> = (data: unknown) => T

export interface ApiRequestOptions<T = unknown> {
  /** Serialised into the URL with proper encoding. */
  query?: QueryParams
  /** Extra headers, e.g. `{ Authorization: 'Bearer …' }` once auth exists. Override defaults. */
  headers?: Readonly<Record<string, string>>
  /** Serialised as JSON. `undefined` means no body. */
  body?: unknown
  /** Cancels the request (reported as `kind: 'aborted'`). */
  signal?: AbortSignal
  /** Per-request timeout in ms; overrides the client default. `0` disables the timeout. */
  timeoutMs?: number
  /** Validates the parsed response; failures are reported as `kind: 'parse'`. */
  parse?: ResponseParser<T>
}

/** Options for requests that must not send a body. */
export type ApiRequestOptionsWithoutBody<T = unknown> = Omit<ApiRequestOptions<T>, 'body'>

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>

export interface ApiClientOptions {
  /**
   * Absolute base URL or same-origin path (e.g. "/api"), or a function returning one.
   * A function is evaluated on every request, so configuration problems surface
   * as request errors instead of breaking app start-up.
   */
  baseUrl: string | (() => string)
  /** Default timeout in ms (default 15 000). `0` disables it. */
  timeoutMs?: number
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: FetchFunction
}

export interface ApiClient {
  request<T = unknown>(method: HttpMethod, path: string, options?: ApiRequestOptions<T>): Promise<T>
  get<T = unknown>(path: string, options?: ApiRequestOptionsWithoutBody<T>): Promise<T>
  post<T = unknown>(path: string, options?: ApiRequestOptions<T>): Promise<T>
  put<T = unknown>(path: string, options?: ApiRequestOptions<T>): Promise<T>
  patch<T = unknown>(path: string, options?: ApiRequestOptions<T>): Promise<T>
  delete<T = unknown>(path: string, options?: ApiRequestOptions<T>): Promise<T>
}
