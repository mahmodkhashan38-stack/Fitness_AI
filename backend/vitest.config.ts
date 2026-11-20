import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    // Real sockets and a real (failing) MongoDB connection attempt: allow a little time.
    testTimeout: 20_000,
  },
})
