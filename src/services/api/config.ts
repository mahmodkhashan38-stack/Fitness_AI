import { ApiError } from '@/services/api/errors'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export interface ApiBaseUrlRules {
  /** Require https for absolute URLs (local hosts excepted). Enabled in production builds. */
  requireHttps: boolean
}

function configError(message: string): ApiError {
  return new ApiError({ kind: 'config', message })
}

/**
 * Validates and normalises an API base URL (trailing slashes removed).
 * Accepts an absolute http(s) URL or a same-origin path such as "/api".
 * Throws `ApiError` (`kind: 'config'`) when missing or unsafe.
 */
export function resolveApiBaseUrl(raw: string | undefined, rules: ApiBaseUrlRules): string {
  const value = raw?.trim() ?? ''
  if (value === '') {
    throw configError('VITE_API_BASE_URL is not set. Copy .env.example to .env.local and set it to use the API.')
  }

  if (value.startsWith('/')) {
    if (value.startsWith('//')) throw configError('VITE_API_BASE_URL must not be protocol-relative ("//host").')
    if (/[?#]/.test(value)) throw configError('VITE_API_BASE_URL must not contain a query string or hash.')
    return value.replace(/\/+$/, '')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw configError('VITE_API_BASE_URL must be an absolute http(s) URL or a path starting with "/".')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw configError('VITE_API_BASE_URL must use http or https.')
  }
  if (url.username || url.password) {
    throw configError('VITE_API_BASE_URL must not contain credentials.')
  }
  if (url.search || url.hash) {
    throw configError('VITE_API_BASE_URL must not contain a query string or hash.')
  }
  if (rules.requireHttps && url.protocol === 'http:' && !LOCAL_HOSTS.has(url.hostname)) {
    throw configError('VITE_API_BASE_URL must use https in production builds.')
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

/** Reads the base URL from the Vite environment. Called lazily, per request. */
export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, { requireHttps: import.meta.env.PROD })
}
