import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ManifestOptions } from 'vite-plugin-pwa'
import { NETWORK_ONLY_PATHS, PWA_BACKGROUND_COLOR, PWA_THEME_COLOR, pwaOptions } from './pwa.config.ts'

const manifest = pwaOptions.manifest as Partial<ManifestOptions>
const workbox = pwaOptions.workbox!
// Vitest runs from the project root (jsdom's URL can't build file: URLs).
const fromRoot = (path: string) => resolve(process.cwd(), path)
const indexHtml = readFileSync(fromRoot('index.html'), 'utf8')

/** Width, height and colour type (2 = RGB, 6 = RGBA) from a PNG's IHDR chunk. */
function pngInfo(publicPath: string) {
  const data = readFileSync(fromRoot(`public${publicPath}`))
  expect(data.subarray(1, 4).toString('ascii')).toBe('PNG')
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25] }
}

const isNetworkOnly = (path: string) => NETWORK_ONLY_PATHS.some((pattern) => pattern.test(path))

describe('web app manifest', () => {
  it('describes an installable standalone app at the site root', () => {
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Fitness AI',
      short_name: 'Fitness AI',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      lang: 'en',
    })
  })

  it('does not lock orientation (WCAG 1.3.4)', () => {
    expect(manifest.orientation).toBeUndefined()
  })

  it('uses the design-system background for theme and splash colours', () => {
    expect(manifest.theme_color).toBe(PWA_THEME_COLOR)
    expect(manifest.background_color).toBe(PWA_BACKGROUND_COLOR)
    // Same colour as the light theme-color meta tag in index.html
    expect(indexHtml.toLowerCase()).toContain(`<meta name="theme-color" content="${PWA_THEME_COLOR}" media="(prefers-color-scheme: light)" />`)
  })

  it('lists 192 px and 512 px icons plus a separate maskable icon', () => {
    expect(manifest.icons).toEqual([
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ])
  })

  it.each([
    ['/pwa-192x192.png', 192],
    ['/pwa-512x512.png', 512],
    ['/pwa-maskable-512x512.png', 512],
    ['/apple-touch-icon-180x180.png', 180],
  ])('%s exists with the declared size', (path, size) => {
    expect(pngInfo(path)).toMatchObject({ width: size, height: size })
  })

  it.each(['/pwa-maskable-512x512.png', '/apple-touch-icon-180x180.png'])(
    '%s is opaque (full-bleed icons must not contain transparency)',
    (path) => {
      expect(pngInfo(path).colorType).toBe(2)
    },
  )
})

describe('index.html mobile metadata', () => {
  it.each([
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png" />',
    '<meta name="apple-mobile-web-app-title" content="Fitness AI" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
  ])('contains %s', (tag) => {
    expect(indexHtml).toContain(tag)
  })

  it('does not hard-code the manifest link (the plugin injects it with the correct base)', () => {
    expect(indexHtml).not.toContain('rel="manifest"')
  })
})

describe('service worker caching rules', () => {
  it('waits for the user before activating a new version', () => {
    expect(pwaOptions.registerType).toBe('prompt')
    expect(workbox.skipWaiting).toBe(false)
    expect(workbox.clientsClaim).toBe(false)
    expect(workbox.cleanupOutdatedCaches).toBe(true)
  })

  it('has no runtime caching, so API responses and tokens are never stored', () => {
    expect(workbox.runtimeCaching ?? []).toEqual([])
  })

  it('precaches only static build output (no source maps, JSON or API data)', () => {
    expect(workbox.globPatterns).toEqual(['**/*.{html,js,css,woff2,svg,png}'])
    expect(workbox.globPatterns?.join()).not.toMatch(/json|map|api/)
  })

  it('serves the app shell for navigations, except under /api', () => {
    expect(workbox.navigateFallback).toBe('/index.html')
    expect(workbox.navigateFallbackDenylist).toBe(NETWORK_ONLY_PATHS)
  })

  it.each(['/api', '/api/', '/api/health', '/api/workouts/123', '/api?x=1', '/api/health?verbose=1'])('treats %s as network-only', (path) => {
    expect(isNetworkOnly(path)).toBe(true)
  })

  it.each(['/', '/workouts', '/settings/profile', '/apiary', '/design-system', '/api-docs', '/workouts?from=/api'])(
    'serves %s from the app shell',
    (path) => {
      expect(isNetworkOnly(path)).toBe(false)
    },
  )

  it('is disabled in development', () => {
    expect(pwaOptions.devOptions?.enabled).toBe(false)
  })
})
