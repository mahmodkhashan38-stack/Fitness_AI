import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests (layout regressions that jsdom can't measure). They run against the production build
 * served by `vite preview`, with the API mocked per test (e2e/support/mock-api.ts): no backend,
 * database or network access needed.
 *
 * First run on a machine: `npx playwright install chromium`.
 */
const PORT = 4173

/** Phones and small tablets in portrait (mobile emulation); tablets and desktops (desktop emulation). */
export const MOBILE_WIDTHS = [320, 360, 375, 390, 414] as const
export const DESKTOP_WIDTHS = [768, 1024, 1280, 1440] as const

const mobile = { ...devices['Pixel 7'], isMobile: true, hasTouch: true }
const desktop = { ...devices['Desktop Chrome'], isMobile: false, hasTouch: false }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The app's service worker would answer requests itself and bypass the API mocks.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-light', use: { ...mobile, colorScheme: 'light' }, metadata: { widths: MOBILE_WIDTHS } },
    { name: 'mobile-dark', use: { ...mobile, colorScheme: 'dark' }, metadata: { widths: MOBILE_WIDTHS } },
    { name: 'desktop-light', use: { ...desktop, colorScheme: 'light' }, metadata: { widths: DESKTOP_WIDTHS } },
    { name: 'desktop-dark', use: { ...desktop, colorScheme: 'dark' }, metadata: { widths: DESKTOP_WIDTHS } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
