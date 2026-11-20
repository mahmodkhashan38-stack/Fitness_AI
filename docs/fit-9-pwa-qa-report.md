# FIT-9 — Progressive Web App Foundation: QA Report

Date: 2026-11-20 · Base commit: `3f77ea9` (FIT-8) · Scope: frontend only (backend unchanged)

## 1. Summary

Fitness AI can now be installed from a public HTTPS link:

- Android: Chrome's install / "Add to Home screen".
- iPhone: Safari's "Add to Home Screen".

There is no App Store or Google Play listing and no native build.

- The app opens in its own window (`display: standalone`) with the Fitness AI icon.
- It starts offline from a precached app shell.
- When a new version is deployed, it offers the update instead of switching versions mid-session.
- `/api/*` is never served from or stored in a cache.

A PWA is **not** equivalent to a native IPA/APK. See section 6 for the actual platform limits.

## 2. Implementation

| Area | Decision |
|---|---|
| Tooling | `vite-plugin-pwa` 2.0 (Workbox 7.4, `generateSW`). Configuration lives in `pwa.config.ts` so the rules are unit-testable. |
| Manifest | `id`/`start_url`/`scope` `/`, `name` and `short_name` "Fitness AI", `display: standalone`, `lang: en`, `theme_color` and `background_color` `#f6f8f4` (light-theme background, the same as the existing `theme-color` meta tag). |
| Orientation | **Not locked.** The layout is portrait-first and also works in landscape. Locking would fail WCAG 2.1 SC 1.3.4 (Orientation). |
| Icons | `pwa-192x192.png` and `pwa-512x512.png` (purpose `any`), `pwa-maskable-512x512.png` (purpose `maskable`, opaque, glyph inside the 80% safe zone), `apple-touch-icon-180x180.png` (opaque, full bleed, since iOS adds its own corner mask), `favicon.svg`. |
| Branding | The icons reproduce the in-app `BrandLogo` mark: the lime tile `#b5ed59` with Lucide's "Activity" pulse glyph in `#18220a`, stroke 2.5, at the same glyph-to-tile ratio. The previous `favicon.svg` was Vite's default template logo (purple lightning bolt), not Fitness AI branding, so it was replaced with the same mark. |
| iOS / Android metadata | `apple-touch-icon` link, `apple-mobile-web-app-title`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `application-name`, and `apple-mobile-web-app-status-bar-style: default`. With `default` the status bar keeps its own background, so its text is readable in both themes; `black-translucent` puts white text over the light theme. `format-detection: telephone=no` stops iOS turning numbers such as weights into phone links. The existing `viewport-fit=cover` and safe-area paddings (header, bottom navigation, dialogs) are kept. |
| Precache | Only the build output (`**/*.{html,js,css,woff2,svg,png}`) plus the manifest: 17 files, 654 KiB. Hashed assets have `revision: null`; non-hashed files (`index.html`, icons, manifest) carry a content hash. Each deploy therefore produces a complete, consistent set. |
| Navigation | Navigations get the precached `index.html` (the SPA shell), so deep links open offline. `/api`, `/api/…` and `/api?…` are excluded (Workbox checks the path *and* query string). |
| Runtime caching | **None.** API calls, `Authorization` headers and user data are never written to Cache Storage by the service worker. |
| Updates | `registerType: 'prompt'`, `skipWaiting: false`, `clientsClaim: false`, `cleanupOutdatedCaches: true`. Flow: (1) a new version installs in the background; (2) a non-modal notice says it is available; (3) the user taps **Reload to update**, or dismisses the notice and gets the update the next time the app starts. A running page is never switched silently. Open apps check for updates hourly and whenever they return to the foreground. |
| Registration | `src/app/pwa/ServiceWorkerUpdates.tsx` (app layer) registers via `virtual:pwa-register`. In development and tests the plugin replaces this with a no-op, so `npm run dev` never installs a service worker. |
| Offline UX | `useOnlineStatus` (hook) and `OfflineIndicator` (components/feedback): a small non-blocking notice, announced through a persistent `role="status"` region, above the bottom navigation and safe area. API errors still go through the existing FIT-6 error handling. |
| Install prompts | None. There are no custom install banners or popups (`beforeinstallprompt` is not intercepted). |
| Dev/preview | The production preview forwards `/api` to the backend, as the dev server already did, so the installed app can be tested end to end locally. |
| Dependency audit | `workbox-build` pins `glob@^11`, which has a moderate advisory (GHSA-3g3m-2fjr-6pw4, plus minimatch GHSA-g3hv-75wg-m249). It is build-time only. The only fix npm offers is a downgrade to `vite-plugin-pwa` 1.1.0, so `package.json` instead pins `glob@^14.0.2` via `overrides` for `workbox-build` (same `globSync` API). Verified: the generated `sw.js` is byte-identical with and without the override; `npm audit` reports 0 vulnerabilities. |

### Files

- **New:**
  - `pwa.config.ts`, `pwa.config.test.ts`, `scripts/verify-pwa.mjs`
  - `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png`, `public/apple-touch-icon-180x180.png`
  - `src/app/pwa/PwaStatus.tsx`, `src/app/pwa/ServiceWorkerUpdates.tsx` (+ test)
  - `src/components/feedback/OfflineIndicator.tsx` (+ test), `src/components/feedback/UpdateAvailableNotice.tsx` (+ test)
  - `src/hooks/useOnlineStatus.ts` (+ test)
  - this report
- **Changed:**
  - `index.html`, `public/favicon.svg`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.node.json`
  - `package.json` / `package-lock.json` (`vite-plugin-pwa`, `workbox-window`, `verify:pwa` script, `glob` override)
  - `src/app/App.tsx`, `src/vite-env.d.ts`, `README.md`, `docs/architecture.md`

## 3. Automated verification

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` (incl. layer import rules) | Pass |
| `npm test` | **277 / 277** (was 225; +36 config/caching-rule tests, +16 component/hook tests) |
| `npm run build` | Pass. JS 365.9 kB (gzip 114.1 kB, +7.9 kB), plus a lazily loaded `workbox-window` chunk of 5.6 kB; CSS 52.3 kB |
| `npm run verify:pwa` (new, checks `dist/`) | Pass: manifest fields, icon files and sizes, manifest/apple-touch links, every build asset precached, no duplicates, no `/api` entries, a single navigation route with the `/api` denylist, no runtime caching, no `clientsClaim`, `skipWaiting` only on the user's request. Negative test: a service worker without the `/api` denylist is rejected. |
| `npm audit` | 0 vulnerabilities |
| Backend regression (`backend/`, unchanged) | typecheck, lint, 75 / 75 tests, build |

**Unit tests cover:**
- **Manifest:** fields, no orientation lock, colours matching `index.html`, icon list.
- **Icons:** PNG dimensions read from the files, and maskable/Apple icons opaque.
- **`index.html`:** iOS/Android meta tags, no hard-coded manifest link.
- **Caching rules:** prompt updates, no runtime caching, the precache file types.
- **Network-only URLs:** `/api`, `/api/`, `/api/health`, `/api?x=1` and `/api/health?verbose=1` are network-only; `/apiary`, `/api-docs` and `/workouts?from=/api` are not.
- **Update flow:** the waiting/reload/dismiss logic, hourly and foreground update checks (skipped offline or while installing), cleanup on unmount, no "offline ready" message.
- **Offline indicator:** the offline/online indicator and its live region.

The query-string case caught a real gap during development: the first pattern (`/^\/api(?:\/|$)/`) would have answered a navigation to `/api?x=1` with the app shell.

## 4. Production-preview verification (browser)

**Setup:**
- `npm run build`, then `vite preview` (the production build, not the dev server), with the `/api` proxy pointing at a local instance of the FIT-8 Express app.
- Browser: Google Chrome (headless) via Playwright, with a 390 × 844 mobile viewport (touch, DPR 2) plus 1280 × 800 and 320 × 640 dark-mode runs.
- For the update test, a second build (v2) differed from v1 only in one visible string.

**Result: 41 / 41 checks passed.**

| Area | Verified |
|---|---|
| Installability | Chrome `Page.getAppManifest`: no errors. `Page.getInstallabilityErrors`: none (checked in a normal, non-incognito profile; Chrome never offers installation in incognito). |
| Manifest and icons | Fields as specified. All icons and the favicon are served with image content types. |
| Registration | The service worker activates with scope `/`. The first visit is not taken over (`controller` is `null`); later loads are controlled. |
| Precache | 17 entries, in one versioned Workbox cache, with no `/api` entries. |
| API isolation | `fetch('/api/health')` (also with an `Authorization` header) is answered by the network, not the service worker. Cache Storage still holds no `/api` entry afterwards. Navigating to `/api/health` and `/api/health?verbose=1` reaches the API, not the app shell. |
| Offline | The offline notice appears when the connection drops. With the network off, `/`, `/settings`, `/progress` and an unknown URL all render from the service worker with CSS and the Inter font. `fetch('/api/health')` rejects, so no stale data is served. Navigating to `/api/health` shows the browser's offline error, not the app. The notice disappears when back online. |
| Updates | After deploying v2: the notice appears and v1 keeps running. A plain reload stays on v1 and shows the notice again. *Dismiss* hides it. *Reload to update* activates v2 (new bundle and new content served, no notice). v1 files are removed from the cache. |
| Layout | At 390 px and 320 px (dark), both notices fit without horizontal overflow and sit above the bottom navigation. Desktop: bottom centre. No unexpected console errors. |

**Test-environment notes:**
- Chrome logs a 404 for `/favicon.ico` when it displays raw JSON at `/api/health`, which has no `<link rel="icon">`. App pages declare the SVG favicon.
- Attaching an additional DevTools (CDP) session stops Playwright's offline emulation from updating `navigator.onLine`. Without it, `navigator.onLine` was `false` on every offline load, including with mobile emulation. That's why the installability checks run in a separate profile.

**Not verified here:**
- Installation on a physical iPhone or Android device. This needs the HTTPS deployment (section 7); browsers only allow service workers on `https://` or `localhost`.
- Lighthouse scores.
- Safari/WebKit behaviour in general. All browser checks used Chrome; iOS behaviour is documented from Apple/WebKit sources and must be confirmed on a device after deployment.

## 5. Installation instructions

### iPhone / iPad (Safari)

1. Open the app's HTTPS address in **Safari**.
2. Tap **Share**: the square with an arrow, in the toolbar or the "⋯" menu, depending on the Safari layout.
3. Scroll down and tap **Add to Home Screen**.
4. Keep **Open as Web App** switched on (iOS 26 and later show this switch). Optionally edit the name, then tap **Add**.
5. Open **Fitness AI** from the Home Screen. It runs full screen without Safari's address bar.

Other iOS browsers can also add to the Home Screen from iOS 16.4. Safari is the reference path. iOS never shows an automatic install prompt.

### Android (Chrome)

1. Open the app's HTTPS address in **Chrome**.
2. Tap the **⋮** menu, then **Install app** (on some versions, **Add to Home screen → Install**). Chrome may also show its own install banner after some use. The app does not show one.
3. Confirm. On devices with Google Play Services, Chrome creates a WebAPK, so the app appears in the launcher and app list like other apps.
4. Open **Fitness AI** from the launcher. It runs in its own window with the maskable icon.

To uninstall: long-press the icon and remove it, as with any app. On Android you can also use Settings → Apps.

## 6. Known PWA limitations

**General:**
- **Not a native app.** It is a website in an app window: no App Store or Play listing, no native APIs beyond what the browser exposes, and the browser's engine and policies apply.
- **Offline is shell-only.** Screens open offline, but anything that needs the API (all future data: workouts, nutrition, coach) needs a connection. Nothing is queued for later sync; offline data entry would need its own design (for example IndexedDB plus sync), which is not part of FIT-9.
- **`navigator.onLine` is a hint.** Wi-Fi without internet still reports "online". API errors are handled by the FIT-6 error UI either way.
- **Updates need one reload.** A deployed version reaches a user after they tap *Reload to update* or restart the app. Open apps check hourly and on returning to the foreground.
- **Theme colour.** The status/title bar follows the OS light/dark setting (`theme-color` meta tags). If a user picks a different theme inside the app, the bar keeps the OS colour. This predates FIT-9.
- **Storage can be cleared.** The browser may evict caches under storage pressure, and clearing site data uninstalls the offline shell. The app then reloads from the network. The server remains the source of truth.

**iOS / iPadOS:**
- Installation is manual (Share → Add to Home Screen). There is no install prompt and no `beforeinstallprompt`.
- iOS shows no custom launch images (`apple-touch-startup-image` was not added), so a plain screen appears briefly when the app starts.
- No Background Sync, Periodic Sync or Background Fetch. The app cannot run while closed.
- Web Push needs iOS 16.4+, the app installed to the Home Screen and the user's permission. It is not implemented in FIT-9.
- Storage policies are stricter than Android's. Don't rely on the device for important data.
- Every iOS browser uses WebKit, so behaviour follows Safari's engine.

**Android:**
- The install entry point is Chrome's menu and its own install promotion.
- The WebAPK requires Google Play Services. On other devices Chrome adds a shortcut instead.

## 7. Requirements for the future HTTPS deployment

1. **HTTPS** on the production domain (free certificates, for example Let's Encrypt or the hosting platform's built-in TLS). Service workers and installation do not work over plain HTTP, except on `localhost`.
2. **SPA fallback:** unknown paths serve `index.html` (already documented in the README).
3. **Caching headers:**
   - `/sw.js`, `/index.html` and `/manifest.webmanifest`: `Cache-Control: no-cache` (always revalidate), so new versions are found.
   - `/assets/*` (content-hashed): `Cache-Control: public, max-age=31536000, immutable`.
   - Icons: a short cache, or `no-cache`.
4. **Content types:** `manifest.webmanifest` as `application/manifest+json`; `sw.js` as JavaScript.
5. **Site root:** serve the app at `/`, because `scope` and `start_url` are `/`. A sub-path would need `base`, `scope` and `start_url` changed together.
6. **API routing:**
   - Recommended: the same origin, with `/api/*` forwarded to the backend and `VITE_API_BASE_URL=/api` (see README). Then CORS isn't involved, and the service worker's `/api` exclusion applies directly.
   - With a separate API domain, the service worker never sees API requests at all.
7. **Backend:** the deployment prerequisites from FIT-8 (`NODE_ENV=production`, `MONGODB_URI`, `CORS_ORIGIN`, Atlas network access, health check `/api/health`).
8. **After the first deployment:**
   - Install on one physical iPhone and one Android phone.
   - Repeat the offline and update checks from section 4 on those devices.
   - Run a Lighthouse PWA/performance audit.
   - Record the results in this report.
