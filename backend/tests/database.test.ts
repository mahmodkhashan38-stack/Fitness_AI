import { afterEach, describe, expect, it } from 'vitest'
import { connectDatabase, DatabaseConnectionError, disconnectDatabase, getDatabaseStatus } from '../src/database/connection.js'

afterEach(async () => {
  await disconnectDatabase()
})

describe('database connection', () => {
  it('reports disconnected before any connection attempt', () => {
    expect(getDatabaseStatus()).toBe('disconnected')
  })

  it('rejects with a redacted DatabaseConnectionError when the server is unreachable', async () => {
    // Port 1 on localhost: nothing listens, so server selection fails after the short timeout.
    const attempt = connectDatabase('mongodb://fitness:hunter2@127.0.0.1:1/fitness_ai', { serverSelectionTimeoutMS: 300 })

    await expect(attempt).rejects.toBeInstanceOf(DatabaseConnectionError)
    const error = (await attempt.catch((caught: unknown) => caught)) as DatabaseConnectionError
    expect(error.message).toMatch(/^Could not connect to MongoDB:/)
    expect(error.message).not.toContain('hunter2')
    expect(error.cause).toBeDefined()
    expect(getDatabaseStatus()).toBe('disconnected')
  })
})
