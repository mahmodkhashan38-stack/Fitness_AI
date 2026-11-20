import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGracefulShutdown } from '../src/utils/shutdown.js'
import { silentLogger } from './helpers.js'

let server: Server | undefined
afterEach(() => {
  server?.closeAllConnections()
  server?.close()
  server = undefined
})

async function start(handler: Parameters<typeof createServer>[1]) {
  server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server!.once('listening', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

describe('createGracefulShutdown', () => {
  it('lets in-flight requests finish, stops accepting new ones, closes resources, then exits 0', async () => {
    let finishRequest: () => void = () => {}
    const url = await start((_req, res) => {
      finishRequest = () => res.end('done')
    })
    const exit = vi.fn()
    const onClose = vi.fn(async () => {})
    const shutdown = createGracefulShutdown({ server: server!, onClose, logger: silentLogger, exit })

    const inFlight = fetch(url)
    await vi.waitFor(() => expect(server!.listening).toBe(true))
    await new Promise((resolve) => setTimeout(resolve, 50)) // request reaches the handler

    const done = shutdown('SIGTERM')
    await expect(fetch(url)).rejects.toThrow() // no longer accepting connections
    expect(onClose).not.toHaveBeenCalled()

    finishRequest()
    expect(await (await inFlight).text()).toBe('done')
    await done
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('is idempotent (repeated signals trigger one shutdown)', async () => {
    await start((_req, res) => res.end())
    const exit = vi.fn()
    const onClose = vi.fn(async () => {})
    const shutdown = createGracefulShutdown({ server: server!, onClose, logger: silentLogger, exit })
    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('uses the given exit code (e.g. 1 after an uncaught exception)', async () => {
    await start((_req, res) => res.end())
    const exit = vi.fn()
    await createGracefulShutdown({ server: server!, onClose: async () => {}, logger: silentLogger, exit })('uncaughtException', 1)
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('forces exit 1 when requests do not finish within the timeout', async () => {
    const url = await start(() => {
      /* never responds */
    })
    const exit = vi.fn()
    const onClose = vi.fn(async () => {})
    const shutdown = createGracefulShutdown({ server: server!, onClose, logger: silentLogger, exit, timeoutMs: 100 })

    const hanging = fetch(url).catch(() => 'connection destroyed')
    await new Promise((resolve) => setTimeout(resolve, 50))
    void shutdown('SIGTERM')

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1), { timeout: 2000 })
    expect(await hanging).toBe('connection destroyed')
  })

  it('exits 1 when closing resources fails', async () => {
    await start((_req, res) => res.end())
    const exit = vi.fn()
    const onClose = vi.fn(async () => {
      throw new Error('disconnect failed')
    })
    await createGracefulShutdown({ server: server!, onClose, logger: silentLogger, exit })('SIGTERM')
    expect(exit).toHaveBeenCalledWith(1)
  })
})
