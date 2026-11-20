import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig((env) =>
  mergeConfig(
    viteConfig(env),
    defineConfig({
      test: {
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}', 'pwa.config.test.ts'],
        setupFiles: ['src/test/setup.ts'],
        restoreMocks: true,
      },
    }),
  ),
)
