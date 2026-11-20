import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { securityHeaders } from './deploy/security-headers.ts'
import { pwaOptions } from './pwa.config.ts'

export default defineConfig(({ mode }) => {
  // Not VITE_-prefixed: only read here, never exposed to the browser bundle.
  const { DEV_API_PROXY_TARGET = 'http://localhost:3000' } = loadEnv(mode, process.cwd(), 'DEV_')
  // Public value (also embedded in the bundle); used here only to allow the API origin in the CSP.
  const { VITE_API_BASE_URL } = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react(), tailwindcss(), VitePWA(pwaOptions), securityHeaders({ apiBaseUrl: VITE_API_BASE_URL })],
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
    // `npm run preview` serves the production build; forward /api there too so the installed
    // app can be tested end to end locally.
    preview: {
      proxy: {
        '/api': { target: DEV_API_PROXY_TARGET, changeOrigin: false },
      },
    },
  }
})
