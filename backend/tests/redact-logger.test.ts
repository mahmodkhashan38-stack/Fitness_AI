import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '../src/utils/logger.js'
import { redactSecrets } from '../src/utils/redact.js'

afterEach(() => vi.restoreAllMocks())

describe('redactSecrets', () => {
  it.each([
    ['mongodb+srv://user:p%40ss@cluster0.mongodb.net/db', 'mongodb+srv://***:***@cluster0.mongodb.net/db'],
    ['mongodb://user@host:27017', 'mongodb://***:***@host:27017'],
    ['failed: mongodb://a:b@h1,h2/db?x=1', 'failed: mongodb://***:***@h1,h2/db?x=1'],
    ['https://example.com/?token=abc&x=1', 'https://example.com/?token=***&x=1'],
    ['password=hunter2 apiKey=xyz', 'password=*** apiKey=***'],
    ['mongodb://cluster0.mongodb.net/db', 'mongodb://cluster0.mongodb.net/db'],
  ])('%s', (input, expected) => {
    expect(redactSecrets(input)).toBe(expected)
  })
})

describe('createLogger', () => {
  it('writes one JSON line per entry, redacting messages, fields and error stacks', () => {
    const out = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('cannot reach mongodb://admin:hunter2@db.example.com')
    createLogger().error('failed for mongodb://admin:hunter2@x', { error, uri: 'mongodb://admin:hunter2@x' })

    expect(out).toHaveBeenCalledTimes(1)
    const line = out.mock.calls[0]?.[0] as string
    expect(line).not.toContain('hunter2')
    const entry = JSON.parse(line) as Record<string, unknown>
    expect(entry).toMatchObject({ level: 'error', error: { name: 'Error', message: expect.stringContaining('***:***@') } })
  })

  it('routes info to stdout and respects the level threshold and silent mode', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ level: 'info' })
    logger.debug('hidden')
    logger.info('shown')
    expect(log).toHaveBeenCalledTimes(1)
    createLogger({ silent: true }).error('nothing')
    expect(err).not.toHaveBeenCalled()
  })

  it('serialises error causes', () => {
    const out = vi.spyOn(console, 'error').mockImplementation(() => {})
    createLogger().error('outer', { error: new Error('outer', { cause: new Error('inner token=abc') }) })
    const entry = JSON.parse(out.mock.calls[0]?.[0] as string) as { error: { cause: { message: string } } }
    expect(entry.error.cause.message).toBe('inner token=***')
  })
})
