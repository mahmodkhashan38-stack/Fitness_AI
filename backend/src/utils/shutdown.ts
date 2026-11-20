import type { Server } from 'node:http'
import type { Logger } from './logger.js'

export interface ShutdownOptions {
  server: Server
  /** Releases other resources (e.g. the database) after the HTTP server has closed. */
  onClose: () => Promise<void>
  logger: Logger
  /** Force exit if shutdown takes longer than this (default 10 s). */
  timeoutMs?: number
  exit?: (code: number) => void
}

/**
 * Returns an idempotent shutdown function:
 * stop accepting connections → let in-flight requests finish → close resources → exit.
 * If that takes longer than `timeoutMs`, remaining connections are destroyed and the process exits with 1.
 */
export function createGracefulShutdown({
  server,
  onClose,
  logger,
  timeoutMs = 10_000,
  exit = (code) => process.exit(code),
}: ShutdownOptions): (reason: string, exitCode?: number) => Promise<void> {
  let started = false

  return async (reason, exitCode = 0) => {
    if (started) return
    started = true
    logger.info('Shutting down', { reason })

    const timer = setTimeout(() => {
      logger.error('Shutdown timed out; closing remaining connections', { timeoutMs })
      server.closeAllConnections()
      exit(1)
    }, timeoutMs)
    timer.unref()

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        server.closeIdleConnections()
      })
      await onClose()
      clearTimeout(timer)
      logger.info('Shutdown complete')
      exit(exitCode)
    } catch (error) {
      clearTimeout(timer)
      logger.error('Error during shutdown', { error })
      exit(1)
    }
  }
}
