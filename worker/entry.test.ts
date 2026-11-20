import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as entry from './index.ts'
import { parseApiOrigin } from './proxy.ts'

/** Minimal JSONC reader: removes // and /* comments outside strings. */
function readJsonc(path: string): Record<string, unknown> {
  const text = readFileSync(path, 'utf8')
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (inString) {
      out += char
      if (char === '\\') out += text[++i] ?? ''
      else if (char === '"') inString = false
    } else if (char === '"') {
      inString = true
      out += char
    } else if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (char === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1
    } else {
      out += char
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1')) as Record<string, unknown>
}

describe('Worker entry module', () => {
  it('exports only the default handler (workerd rejects other named exports)', () => {
    expect(Object.keys(entry)).toEqual(['default'])
    expect(typeof entry.default.fetch).toBe('function')
  })
})

describe('wrangler.jsonc', () => {
  const config = readJsonc(resolve(process.cwd(), 'wrangler.jsonc'))
  const assets = config.assets as Record<string, unknown>
  const vars = (config.vars ?? {}) as Record<string, unknown>

  it('serves dist/ and runs the Worker script only for /api/*', () => {
    expect(config.main).toBe('worker/index.ts')
    expect(assets.directory).toBe('./dist')
    expect(assets.run_worker_first).toEqual(['/api/*'])
  })

  it('serves index.html without a redirect (the service worker precaches it as the offline shell)', () => {
    expect(assets.html_handling).toBe('none')
  })

  it('falls back to index.html for client-side routes', () => {
    expect(assets.not_found_handling).toBe('single-page-application')
  })

  it('keeps secrets out of the committed configuration', () => {
    expect(Object.keys(vars)).toEqual(['API_ORIGIN'])
    expect(JSON.stringify(config)).not.toMatch(/PROXY_SECRET"\s*:/)
  })

  it('points at an HTTPS API origin', () => {
    expect(parseApiOrigin(vars.API_ORIGIN as string)?.protocol).toBe('https:')
  })
})
