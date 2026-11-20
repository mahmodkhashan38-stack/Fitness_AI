import { existsSync } from 'node:fs'
import { createApp } from './app.js'
import { ConfigError, loadConfig } from './config/env.js'
import { connectDatabase, disconnectDatabase, getDatabaseStatus, supportsTransactions } from './database/connection.js'
import { FitnessProfileModel } from './models/fitness-profile.js'
import { SessionModel } from './models/session.js'
import { UserModel } from './models/user.js'
import { createLogger } from './utils/logger.js'
import { createGracefulShutdown } from './utils/shutdown.js'

// Local development: load backend/.env if present (Node's built-in loader, no dependency).
// In production, variables come from the hosting environment.
if (existsSync('.env')) process.loadEnvFile('.env')

const logger = createLogger({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })

async function main(): Promise<void> {
  let config
  try {
    config = loadConfig()
  } catch (error) {
    if (error instanceof ConfigError) {
      logger.error('Startup aborted: invalid configuration', { problems: error.problems })
      process.exitCode = 1
      return
    }
    throw error
  }

  try {
    await connectDatabase(config.mongodbUri, { autoIndex: !config.isProduction, logger })
  } catch (error) {
    logger.error('Startup aborted: could not connect to MongoDB. Check MONGODB_URI, the Atlas network access list and database user.', { error })
    await disconnectDatabase().catch(() => {})
    process.exitCode = 1
    return
  }

  // Registration writes the user and their fitness profile in one transaction (FIT-12).
  try {
    if (!(await supportsTransactions())) {
      logger.error(
        'Startup aborted: MongoDB does not support transactions. Use a replica set (every MongoDB Atlas cluster is one; ' +
          'locally: start mongod with --replSet rs0 and run rs.initiate() once).',
      )
      await disconnectDatabase().catch(() => {})
      process.exitCode = 1
      return
    }
  } catch (error) {
    logger.error('Startup aborted: could not check MongoDB capabilities.', { error })
    await disconnectDatabase().catch(() => {})
    process.exitCode = 1
    return
  }

  // autoIndex is off in production, so build the indexes the app depends on (unique email,
  // unique session token, session TTL, one fitness profile per user) explicitly.
  // Idempotent; needs only readWrite. Existing users and sessions are untouched.
  try {
    await Promise.all([UserModel.createIndexes(), SessionModel.createIndexes(), FitnessProfileModel.createIndexes()])
  } catch (error) {
    logger.error('Startup aborted: could not create database indexes.', { error })
    await disconnectDatabase().catch(() => {})
    process.exitCode = 1
    return
  }

  const app = createApp({ config, getDatabaseStatus, logger })
  const server = app.listen(config.port)

  server.on('listening', () =>
    logger.info('API listening', { port: config.port, nodeEnv: config.nodeEnv, trustProxyHops: config.trustProxyHops }),
  )
  server.on('error', async (error) => {
    logger.error('Server failed to start', { error })
    await disconnectDatabase().catch(() => {})
    process.exit(1)
  })

  const shutdown = createGracefulShutdown({ server, onClose: disconnectDatabase, logger })
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { error: reason })
    void shutdown('unhandledRejection', 1)
  })
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error })
    void shutdown('uncaughtException', 1)
  })
}

void main()
