import { afterEach, describe, expect, it, vi } from 'vitest'
import { getApiBaseUrl, resolveApiBaseUrl } from '@/services/api/config'
import { isApiError } from '@/services/api/errors'

const dev = { requireHttps: false }
const prod = { requireHttps: true }

function configErrorMessage(raw: string | undefined, rules = dev): string {
  try {
    resolveApiBaseUrl(raw, rules)
  } catch (error) {
    if (isApiError(error) && error.kind === 'config') return error.message
    throw error
  }
  throw new Error('Expected a config error')
}

describe('resolveApiBaseUrl', () => {
  it('accepts absolute https/http URLs and trims trailing slashes and whitespace', () => {
    expect(resolveApiBaseUrl('  https://api.example.com/v1/  ', dev)).toBe('https://api.example.com/v1')
    expect(resolveApiBaseUrl('http://localhost:3000', dev)).toBe('http://localhost:3000')
    expect(resolveApiBaseUrl('https://api.example.com', prod)).toBe('https://api.example.com')
  })

  it('accepts same-origin paths (e.g. behind a reverse proxy)', () => {
    expect(resolveApiBaseUrl('/api/', dev)).toBe('/api')
    expect(resolveApiBaseUrl('/api', prod)).toBe('/api')
  })

  it('reports a missing or blank value clearly', () => {
    expect(configErrorMessage(undefined)).toContain('VITE_API_BASE_URL is not set')
    expect(configErrorMessage('   ')).toContain('VITE_API_BASE_URL is not set')
  })

  it.each([
    ['not a url', 'absolute http(s) URL'],
    ['api.example.com', 'absolute http(s) URL'],
    ['ftp://api.example.com', 'http or https'],
    ['javascript:alert(1)', 'http or https'],
    ['https://user:pass@api.example.com', 'credentials'],
    ['https://api.example.com/v1?key=abc', 'query string'],
    ['https://api.example.com/#x', 'query string'],
    ['//api.example.com', 'protocol-relative'],
    ['/api?x=1', 'query string'],
  ])('rejects %s', (raw, expected) => {
    expect(configErrorMessage(raw)).toContain(expected)
  })

  it('requires https in production, except for local hosts', () => {
    expect(configErrorMessage('http://api.example.com', prod)).toContain('https in production')
    expect(resolveApiBaseUrl('http://localhost:8080/api', prod)).toBe('http://localhost:8080/api')
    expect(resolveApiBaseUrl('http://127.0.0.1:8080', prod)).toBe('http://127.0.0.1:8080')
  })
})

describe('getApiBaseUrl (reads the Vite environment)', () => {
  afterEach(() => vi.unstubAllEnvs())

  const inProduction = (url: string) => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_API_BASE_URL', url)
  }

  it('production build: accepts a same-origin path such as /api (no scheme, so no https check applies)', () => {
    inProduction('/api')
    expect(import.meta.env.PROD).toBe(true)
    expect(getApiBaseUrl()).toBe('/api')
    inProduction('/api/v1/')
    expect(getApiBaseUrl()).toBe('/api/v1')
  })

  it('production build: accepts https, rejects plain http on a public host', () => {
    inProduction('https://api.example.com/v1')
    expect(getApiBaseUrl()).toBe('https://api.example.com/v1')
    inProduction('http://api.example.com/v1')
    expect(() => getApiBaseUrl()).toThrow('https in production')
  })

  it('production build: still rejects protocol-relative URLs, which would inherit the page scheme and host', () => {
    inProduction('//api.example.com')
    expect(() => getApiBaseUrl()).toThrow('protocol-relative')
  })

  it('development build: allows plain http for a local or LAN backend', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_API_BASE_URL', 'http://192.168.1.20:3000/api')
    expect(getApiBaseUrl()).toBe('http://192.168.1.20:3000/api')
  })
})
