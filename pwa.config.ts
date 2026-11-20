import type { VitePWAOptions } from 'vite-plugin-pwa'

/**
 * Progressive Web App configuration (FIT-9). Kept separate from vite.config.ts so the
 * caching rules can be unit-tested (pwa.config.test.ts).
 *
 * Caching policy (conservative):
 * - Only the versioned build output (JS/CSS/fonts with content hashes, icons, index.html)
 *   is precached. Workbox stores each file with a revision hash, so a new build never
 *   mixes files from different versions.
 * - Navigations are answered with the precached app shell (index.html) so the app opens
 *   offline. /api/* is excluded from that fallback.
 * - No runtime caching at all: API requests (and anything else not precached) always go
 *   to the network, so tokens, user data and API responses are never stored by the
 *   service worker.
 * - Updates use registerType "prompt": a new version installs in the background and waits;
 *   the app shows "New version available" and activates it only when the user reloads.
 */

/** Same colours as the theme-color meta tags in index.html (light theme background). */
export const PWA_THEME_COLOR = '#f6f8f4'
export const PWA_BACKGROUND_COLOR = '#f6f8f4'

/**
 * Requests under these paths are never served from, or stored in, the service worker caches.
 * Workbox tests navigation denylists against pathname + search, so "/api?x" must match too.
 */
export const NETWORK_ONLY_PATHS = [/^\/api(?:[/?]|$)/]

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  // The app registers the service worker itself (src/app/pwa), so the plugin injects no script.
  injectRegister: false,
  // All icons (manifest, favicon, Apple touch icon) are already matched by workbox.globPatterns;
  // adding them again here would list them twice in the precache manifest.
  includeManifestIcons: false,
  manifest: {
    id: '/',
    name: 'Fitness AI',
    short_name: 'Fitness AI',
    description: 'Fitness AI: your AI-powered fitness companion.',
    lang: 'en',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // No orientation lock: the layout is designed portrait-first but also works in
    // landscape, and locking would fail WCAG 2.1 SC 1.3.4 (Orientation).
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{html,js,css,woff2,svg,png}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: NETWORK_ONLY_PATHS,
    // Remove precaches created by older Workbox versions.
    cleanupOutdatedCaches: true,
    // Wait for the user (see registerType); never take over open pages silently.
    skipWaiting: false,
    clientsClaim: false,
    // Deliberately no runtimeCaching.
    runtimeCaching: [],
    sourcemap: false,
  },
  devOptions: {
    // The service worker only exists in production builds (`npm run build` + `npm run preview`).
    enabled: false,
  },
}
