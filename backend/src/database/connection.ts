import mongoose from 'mongoose'
import type { Logger } from '../utils/logger.js'
import { redactSecrets } from '../utils/redact.js'

export type DatabaseStatus = 'disconnected' | 'connected' | 'connecting' | 'disconnecting'

const STATES: Record<number, DatabaseStatus> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
}

/** Current state of the shared Mongoose connection, for diagnostics (e.g. the health endpoint). */
export function getDatabaseStatus(): DatabaseStatus {
  return STATES[mongoose.connection.readyState] ?? 'disconnected'
}

/** Startup failed: MongoDB could not be reached or rejected the connection. Message is redacted. */
export class DatabaseConnectionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DatabaseConnectionError'
  }
}

export interface ConnectOptions {
  /** How long to wait for a reachable server before failing (default 10 s). */
  serverSelectionTimeoutMS?: number
  /** Build indexes automatically. Disable in production; create indexes deliberately instead. */
  autoIndex?: boolean
  logger?: Logger
}

let listenersAttached = false

function attachListeners(logger: Logger | undefined) {
  if (listenersAttached || !logger) return
  listenersAttached = true
  const { connection } = mongoose
  connection.on('connected', () => logger.info('MongoDB connected'))
  connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
  connection.on('reconnected', () => logger.info('MongoDB reconnected'))
  connection.on('error', (error: unknown) => logger.error('MongoDB connection error', { error }))
}

/**
 * Connects the shared Mongoose connection. Rejects with DatabaseConnectionError
 * (credentials removed from the message) if the server can't be reached in time.
 */
export async function connectDatabase(uri: string, options: ConnectOptions = {}): Promise<void> {
  mongoose.set('strictQuery', true)
  attachListeners(options.logger)

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS ?? 10_000,
      autoIndex: options.autoIndex ?? false,
    })
  } catch (error) {
    const reason = error instanceof Error ? redactSecrets(error.message) : 'unknown error'
    throw new DatabaseConnectionError(`Could not connect to MongoDB: ${reason}`, { cause: error })
  }
}

/**
 * Multi-document transactions (used by registration) need a replica set or a sharded cluster.
 * MongoDB Atlas clusters, including the free tier, are replica sets; a plain local `mongod` is not.
 * Uses `hello`, which every authenticated user may run.
 */
export async function supportsTransactions(): Promise<boolean> {
  const db = mongoose.connection.db
  if (!db) throw new Error('Not connected to MongoDB')
  const hello = await db.admin().command({ hello: 1 })
  return typeof hello.setName === 'string' || hello.msg === 'isdbgrid'
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}
