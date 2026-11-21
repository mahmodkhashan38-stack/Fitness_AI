import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    // Real sockets and a real (failing) MongoDB connection attempt: allow a little time.
    testTimeout: 20_000,
    // Each file starts a real single-node replica set (beforeAll), which occasionally takes more
    // than the default 10 s on a busy machine.
    hookTimeout: 60_000,
  },
})
