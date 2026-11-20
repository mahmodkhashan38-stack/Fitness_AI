import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { apiOriginFrom, buildContentSecurityPolicy, buildHeadersFile, inlineScriptHashes } from './security-headers.ts'

const sha = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

/** Parses `_headers` into { path: { header: value } }. */
function parseHeaders(file: string) {
  const rules: Record<string, Record<string, string>> = {}
  let current: Record<string, string> | undefined
  for (const line of file.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!line.startsWith(' ')) {
      current = rules[line.trim()] = {}
    } else {
      const [name, ...value] = line.trim().split(':')
      current![name!] = value.join(':').trim()
    }
  }
  return rules
}

describe('apiOriginFrom', () => {
  it.each([
    ['https://fitness-ai-api.onrender.com/api', 'https://fitness-ai-api.onrender.com'],
    ['https://api.example.com:8443/v1/', 'https://api.example.com:8443'],
    ['http://localhost:3000/api', 'http://localhost:3000'],
  ])('%s → %s', (input, origin) => {
    expect(apiOriginFrom(input)).toBe(origin)
  })

  it.each([undefined, '', '  ', '/api'])('same-origin or empty value %j → null', (input) => {
    expect(apiOriginFrom(input)).toBeNull()
  })

  it.each(['ftp://example.com', 'javascript:alert(1)', 'not a url'])('rejects %s', (input) => {
    expect(() => apiOriginFrom(input)).toThrow()
  })
})

describe('inlineScriptHashes', () => {
  it('hashes inline scripts exactly as written and skips external scripts', () => {
    const html = `<head><script>\n  var a = 1\n</script><script type="module" crossorigin src="/assets/index.js"></script><script>b()</script></head>`
    expect(inlineScriptHashes(html)).toEqual([sha('\n  var a = 1\n'), sha('b()')])
  })

  it('matches the theme script in index.html', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const hashes = inlineScriptHashes(html)
    expect(hashes).toHaveLength(1)
    const themeScript = html.match(/<script>([\s\S]*?)<\/script>/)![1]!
    expect(hashes[0]).toBe(sha(themeScript))
  })
})

describe('buildContentSecurityPolicy', () => {
  const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com', scriptHashes: ["'sha256-abc='"] })
  const directive = (name: string) => csp.split('; ').find((part) => part.startsWith(`${name} `) || part === name)

  it('allows scripts only from the site and the hashed inline script', () => {
    expect(directive('script-src')).toBe("script-src 'self' 'sha256-abc='")
  })

  it('never allows unsafe-inline, unsafe-eval or wildcards', () => {
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/)
  })

  it('allows connections only to the site and the API origin', () => {
    expect(directive('connect-src')).toBe("connect-src 'self' https://api.example.com")
    expect(buildContentSecurityPolicy({ apiOrigin: null, scriptHashes: [] })).toContain("connect-src 'self';")
  })

  it('blocks framing, plugins and foreign base/form targets', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('form-action')).toBe("form-action 'self'")
    expect(directive('upgrade-insecure-requests')).toBe('upgrade-insecure-requests')
  })

  it('keeps the service worker and manifest same-origin', () => {
    expect(directive('worker-src')).toBe("worker-src 'self'")
    expect(directive('manifest-src')).toBe("manifest-src 'self'")
  })
})

describe('buildHeadersFile', () => {
  const rules = parseHeaders(buildHeadersFile("default-src 'self'"))

  it('applies the security headers to every path', () => {
    expect(rules['/*']).toEqual({
      'Content-Security-Policy': "default-src 'self'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    })
  })

  it('caches hashed assets for a year and revalidates version entry points', () => {
    expect(rules['/assets/*']).toEqual({ 'Cache-Control': 'public, max-age=31536000, immutable' })
    for (const path of ['/sw.js', '/index.html', '/manifest.webmanifest']) {
      expect(rules[path]).toEqual({ 'Cache-Control': 'no-cache' })
    }
  })

  it('never sets Cache-Control on the catch-all rule (Cloudflare would join conflicting values)', () => {
    expect(rules['/*']).not.toHaveProperty('Cache-Control')
  })

  it('keeps every line within the 2,000-character limit', () => {
    const long = buildHeadersFile(buildContentSecurityPolicy({ apiOrigin: 'https://fitness-ai-api.onrender.com', scriptHashes: ["'sha256-elvkn3efEdcELB8/plhU44K0aiLgSAH9ZLaL3+BvNhs='"] }))
    expect(Math.max(...long.split('\n').map((line) => line.length))).toBeLessThan(2000)
  })
})
