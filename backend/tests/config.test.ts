import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../src/config/env.js'

const URI = 'mongodb+srv://fitness_user:s3cretPassw0rd@cluster0.abcde.mongodb.net/fitness_ai?retryWrites=true'
const base = { MONGODB_URI: URI }

function problemsFor(env: NodeJS.ProcessEnv): readonly string[] {
  try {
    loadConfig(env)
  } catch (error) {
    if (error instanceof ConfigError) return error.problems
    throw error
  }
  throw new Error('expected ConfigError')
}

describe('loadConfig', () => {
  it('applies development defaults', () => {
    expect(loadConfig(base)).toEqual({
      port: 3000,
      nodeEnv: 'development',
      isProduction: false,
      mongodbUri: URI,
      corsOrigins: ['http://localhost:5173'],
    })
  })

  it('reads a full production configuration', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'production',
      PORT: '8080',
      CORS_ORIGIN: 'https://fitness.example.com, https://www.fitness.example.com/',
    })
    expect(config).toMatchObject({
      port: 8080,
      isProduction: true,
      corsOrigins: ['https://fitness.example.com', 'https://www.fitness.example.com'],
    })
  })

  it('accepts mongodb:// URIs and trims whitespace', () => {
    expect(loadConfig({ MONGODB_URI: '  mongodb://localhost:27017/fitness  ' }).mongodbUri).toBe('mongodb://localhost:27017/fitness')
  })

  it('removes duplicate origins', () => {
    expect(loadConfig({ ...base, CORS_ORIGIN: 'http://localhost:5173,http://localhost:5173/' }).corsOrigins).toEqual([
      'http://localhost:5173',
    ])
  })

  it.each([undefined, '', '   '])('requires MONGODB_URI (%j)', (value) => {
    expect(problemsFor({ MONGODB_URI: value })).toEqual([expect.stringContaining('MONGODB_URI is required')])
  })

  it('rejects non-MongoDB URIs without echoing the value', () => {
    const problems = problemsFor({ MONGODB_URI: 'postgres://user:topsecret@host/db' })
    expect(problems).toEqual([expect.stringContaining('MONGODB_URI must start with')])
    expect(problems.join()).not.toContain('topsecret')
  })

  it.each(['0', '65536', 'abc', '3000.5', '-1', '1e3'])('rejects PORT=%s', (port) => {
    expect(problemsFor({ ...base, PORT: port })).toEqual([expect.stringContaining('PORT')])
  })

  it('rejects unknown NODE_ENV', () => {
    expect(problemsFor({ ...base, NODE_ENV: 'staging' })).toEqual([expect.stringContaining('NODE_ENV')])
  })

  it('requires CORS_ORIGIN in production', () => {
    expect(problemsFor({ ...base, NODE_ENV: 'production' })).toEqual([expect.stringContaining('CORS_ORIGIN is required')])
  })

  it('requires https origins in production', () => {
    expect(problemsFor({ ...base, NODE_ENV: 'production', CORS_ORIGIN: 'http://fitness.example.com' })).toEqual([
      expect.stringContaining('must use https in production'),
    ])
  })

  it.each([
    ['*', '"*" is not allowed'],
    ['not a url', 'not a valid origin'],
    ['https://app.example.com/path', 'origin only'],
    ['https://user:pw@app.example.com', 'origin only'],
    ['ftp://app.example.com', 'http or https'],
    [',', 'at least one origin'],
  ])('rejects CORS_ORIGIN=%j', (value, message) => {
    expect(problemsFor({ ...base, CORS_ORIGIN: value })).toEqual([expect.stringContaining(message)])
  })

  it('reports every problem at once and keeps secrets out of the message', () => {
    const error = (() => {
      try {
        loadConfig({ NODE_ENV: 'production', PORT: 'x', MONGODB_URI: 'http://u:hunter2@x' })
      } catch (caught) {
        return caught as ConfigError
      }
    })()
    expect(error).toBeInstanceOf(ConfigError)
    expect(error?.problems).toHaveLength(3)
    expect(error?.message).not.toContain('hunter2')
  })
})
