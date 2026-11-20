import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

// Runs src/server.ts as a real process from an empty directory (so no .env is loaded).
const serverEntry = fileURLToPath(new URL('../src/server.ts', import.meta.url))
const tsxLoader = import.meta.resolve('tsx')
const cwd = mkdtempSync(join(tmpdir(), 'fitness-api-'))
afterAll(() => rmSync(cwd, { recursive: true, force: true }))

function runServer(env: Record<string, string>): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', tsxLoader, serverEntry], {
      cwd,
      env: { PATH: process.env.PATH ?? '', ...env },
    })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
    const timer = setTimeout(() => child.kill('SIGKILL'), 15_000)
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, output })
    })
  })
}

describe('server startup', () => {
  it('exits with code 1 and lists every configuration problem', async () => {
    const { code, output } = await runServer({ NODE_ENV: 'production', PORT: 'abc' })
    expect(code).toBe(1)
    expect(output).toContain('invalid configuration')
    expect(output).toContain('PORT must be')
    expect(output).toContain('MONGODB_URI is required')
    expect(output).toContain('CORS_ORIGIN is required')
  })

  it('exits with code 1 without leaking credentials when MongoDB is unreachable', async () => {
    const { code, output } = await runServer({
      NODE_ENV: 'development',
      PORT: '3999', // never bound: startup stops before listen
      MONGODB_URI: 'mongodb+srv://fitness:hunter2@cluster-does-not-exist.invalid/fitness_ai',
    })
    expect(code).toBe(1)
    expect(output).toContain('could not connect to MongoDB')
    expect(output).not.toContain('hunter2')
    expect(output).not.toContain('API listening')
  })
})
