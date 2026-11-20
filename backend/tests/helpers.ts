import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import type { Express } from 'express'
import { createApp } from '../src/app.js'
import type { DatabaseStatus } from '../src/database/connection.js'
import { createLogger, type Logger } from '../src/utils/logger.js'

export const silentLogger: Logger = createLogger({ silent: true })

export interface RunningServer {
  url: string
  server: Server
  close: () => Promise<void>
}

/** Starts an app on an ephemeral port so tests exercise real HTTP (headers, parsers, CORS). */
export async function listen(app: Express): Promise<RunningServer> {
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

export function startTestApp(options: { status?: DatabaseStatus; corsOrigins?: string[]; logger?: Logger } = {}) {
  const app = createApp({
    config: { corsOrigins: options.corsOrigins ?? ['http://localhost:5173'] },
    getDatabaseStatus: () => options.status ?? 'connected',
    logger: options.logger ?? silentLogger,
  })
  return listen(app)
}
