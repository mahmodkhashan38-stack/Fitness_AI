import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Not VITE_-prefixed: only read here, never exposed to the browser bundle.
  const { DEV_API_PROXY_TARGET = 'http://localhost:3000' } = loadEnv(mode, process.cwd(), 'DEV_')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // Development only: forward /api to the local backend so the browser talks to one origin
    // (no CORS needed). Production deployments must route /api themselves (see README).
    server: {
      proxy: {
        '/api': { target: DEV_API_PROXY_TARGET, changeOrigin: false },
      },
    },
  }
})
