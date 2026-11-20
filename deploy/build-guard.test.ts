import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { describe, expect, it } from 'vitest'
import { assertWorkersBuildApiBase, isWorkersBuild } from './build-guard.ts'

const ci = { WORKERS_CI: '1' }

describe('isWorkersBuild', () => {
  it.each([
    [{ WORKERS_CI: '1' }, true],
    [{ WORKERS_CI: '0' }, false],
    [{ WORKERS_CI: 'true' }, false],
    [{}, false],
  ])('%j → %s', (env, expected) => {
    expect(isWorkersBuild(env)).toBe(expected)
  })
})

describe('assertWorkersBuildApiBase', () => {
  it('accepts /api in a Workers production build', () => {
    expect(() => assertWorkersBuildApiBase({ mode: 'production', env: ci, apiBaseUrl: '/api' })).not.toThrow()
    expect(() => assertWorkersBuildApiBase({ mode: 'production', env: ci, apiBaseUrl: ' /api ' })).not.toThrow()
  })

  it.each([
    'https://fitness-ai-api-5te2.onrender.com/api',
    'https://fitness-ai-api-5te2.onrender.com',
    '/api/',
    '/API',
    '',
    undefined,
  ])('rejects %j in a Workers production build and explains the fix', (apiBaseUrl) => {
    expect(() => assertWorkersBuildApiBase({ mode: 'production', env: ci, apiBaseUrl })).toThrow(/VITE_API_BASE_URL must be "\/api"/)
  })

  it('does not restrict local builds or other modes', () => {
    expect(() => assertWorkersBuildApiBase({ mode: 'production', env: {}, apiBaseUrl: 'http://localhost:3000/api' })).not.toThrow()
    expect(() => assertWorkersBuildApiBase({ mode: 'development', env: ci, apiBaseUrl: undefined })).not.toThrow()
  })
})

describe('.env.production', () => {
  const root = resolve(import.meta.dirname, '..')

  it('sets VITE_API_BASE_URL=/api and nothing else', () => {
    const lines = readFileSync(resolve(root, '.env.production'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    expect(lines).toEqual(['VITE_API_BASE_URL=/api'])
  })

  it('is what a production build resolves when the environment does not override it', () => {
    const previous = process.env.VITE_API_BASE_URL
    delete process.env.VITE_API_BASE_URL
    try {
      expect(loadEnv('production', root, 'VITE_').VITE_API_BASE_URL).toBe('/api')
    } finally {
      if (previous !== undefined) process.env.VITE_API_BASE_URL = previous
    }
  })

  it('is tracked by Git (not caught by the .env.* ignore rule)', () => {
    const gitignore = readFileSync(resolve(root, '.gitignore'), 'utf8').split('\n')
    expect(gitignore).toContain('!.env.production')
    expect(gitignore.indexOf('!.env.production')).toBeGreaterThan(gitignore.indexOf('.env.*'))
  })
})
