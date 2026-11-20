#!/usr/bin/env node
/**
 * Verifies the PWA output of a production build (run after `npm run build`):
 *   npm run verify:pwa
 * Checks the generated manifest, icons, index.html and service worker against the
 * FIT-9 rules: installable manifest, all icons present, only static build output
 * precached, no runtime caching, /api never handled, updates wait for the user.
 * Exits with code 1 and lists every failure.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const dist = join(process.cwd(), 'dist')
const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}
const read = (file) => readFileSync(join(dist, file))

if (!existsSync(join(dist, 'sw.js'))) {
  console.error('dist/sw.js not found. Run `npm run build` first.')
  process.exit(1)
}

// --- Manifest ---------------------------------------------------------------
const manifest = JSON.parse(read('manifest.webmanifest').toString('utf8'))
for (const [key, value] of Object.entries({
  name: 'Fitness AI',
  short_name: 'Fitness AI',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  id: '/',
})) {
  check(manifest[key] === value, `manifest.${key} should be ${JSON.stringify(value)} (got ${JSON.stringify(manifest[key])})`)
}
check(/^#[0-9a-f]{6}$/i.test(manifest.theme_color ?? ''), 'manifest.theme_color missing')
check(/^#[0-9a-f]{6}$/i.test(manifest.background_color ?? ''), 'manifest.background_color missing')

const pngSize = (file) => {
  const data = read(file)
  return data.subarray(1, 4).toString('ascii') === 'PNG' ? `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}` : 'not a PNG'
}
const icons = manifest.icons ?? []
for (const [sizes, purpose] of [
  ['192x192', 'any'],
  ['512x512', 'any'],
  ['512x512', 'maskable'],
]) {
  const icon = icons.find((entry) => entry.sizes === sizes && (entry.purpose ?? 'any').split(' ').includes(purpose))
  check(Boolean(icon), `manifest has no ${sizes} "${purpose}" icon`)
  if (icon) {
    const file = icon.src.replace(/^\//, '')
    check(existsSync(join(dist, file)), `icon ${icon.src} missing from dist`)
    if (existsSync(join(dist, file))) check(pngSize(file) === sizes, `icon ${icon.src} is ${pngSize(file)}, expected ${sizes}`)
  }
}

// --- index.html ---------------------------------------------------------------
const html = read('index.html').toString('utf8')
check(/<link rel="manifest" href="\/manifest\.webmanifest"/.test(html), 'index.html does not link the manifest')
const touchIcon = html.match(/<link rel="apple-touch-icon"[^>]*href="\/([^"]+)"/)?.[1]
check(Boolean(touchIcon), 'index.html has no apple-touch-icon')
if (touchIcon) check(pngSize(touchIcon) === '180x180', `apple-touch-icon is ${pngSize(touchIcon)}, expected 180x180`)
check(html.includes('viewport-fit=cover'), 'viewport meta lacks viewport-fit=cover')
check(!html.includes('registerSW.js'), 'index.html injects registerSW.js (the app registers the service worker itself)')

// --- Service worker -----------------------------------------------------------
const sw = read('sw.js').toString('utf8')
const precached = [...sw.matchAll(/url:"([^"]+)"/g)].map((match) => match[1])
check(precached.length > 0, 'service worker precaches nothing')
check(new Set(precached).size === precached.length, 'precache manifest contains duplicate URLs')
for (const url of precached) {
  check(existsSync(join(dist, url)), `precached file missing from dist: ${url}`)
  check(!/^\/?api(\/|$)/.test(url), `API path precached: ${url}`)
  check(/\.(html|js|css|woff2|svg|png|webmanifest)$/.test(url), `unexpected file type precached: ${url}`)
}
const builtAssets = readdirSync(join(dist, 'assets')).map((file) => `assets/${file}`).filter((file) => !file.endsWith('.map'))
for (const asset of builtAssets) check(precached.includes(asset), `build asset not precached: ${asset}`)
check(precached.includes('index.html'), 'index.html (app shell) is not precached')

check((sw.match(/registerRoute\(/g) ?? []).length === 1, 'service worker registers routes other than the navigation fallback')
check(/registerRoute\(new \w+\.NavigationRoute\(\w+\.createHandlerBoundToURL\("\/index\.html"\)/.test(sw), 'no app-shell navigation fallback')
const denylist = sw.match(/denylist:\[([^\]]*)\]/)?.[1] ?? ''
check(denylist.includes('\\/api'), 'navigation fallback does not exclude /api')
check(!/CacheFirst|NetworkFirst|StaleWhileRevalidate|ExpirationPlugin|runtimeCaching/.test(sw), 'service worker contains runtime caching')
check(!/clientsClaim\(\)/.test(sw), 'service worker claims clients immediately (updates must wait for the user)')
const skipWaitingCalls = sw.match(/self\.skipWaiting\(\)/g) ?? []
check(
  skipWaitingCalls.length === 1 && /"SKIP_WAITING"===\w+\.data\.type&&self\.skipWaiting\(\)/.test(sw),
  'skipWaiting must only run on the SKIP_WAITING message',
)
check(!/sourceMappingURL/.test(sw), 'service worker ships a source map reference')

if (failures.length) {
  console.error(`PWA verification failed (${failures.length}):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`PWA verification passed: ${precached.length} precached files, ${icons.length} manifest icons, dist=${relative(process.cwd(), dist)}`)
