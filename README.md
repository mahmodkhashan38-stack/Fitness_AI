# Fitness AI

Responsive fitness application (desktop and mobile): a React frontend (repository root) and a
REST API foundation in [`backend/`](backend). The frontend is an installable Progressive Web App
(iPhone via Safari, Android via Chrome; no app stores).

## Stack

- **Frontend:** React 19 · Vite 8 · TypeScript 6 (strict) · Tailwind CSS 4 · React Router 8 · Lucide React · vite-plugin-pwa (Workbox) · ESLint 10 · Vitest 5
- **Backend:** Node.js · Express 5 · TypeScript 6 (strict) · MongoDB Atlas via Mongoose 9 · Helmet · cors · Vitest 5

## Requirements

- **Node.js 22.22.2+ (22.x LTS) or 24.15.0+ (24.x LTS).** Node 23 and 25 are not supported.
  These limits come from the declared `engines` of the toolchain: `jsdom` (tests) needs
  `^22.22.2 || ^24.15.0 || >=26`, React Router 8 needs `>=22.22.0`, Vitest 5 excludes odd-numbered releases.
  Older versions (e.g. Node 24.11) print `EBADENGINE` warnings during `npm install`.
- npm 10 or 11. Install with **`npm ci`** so `package-lock.json` is used exactly and never rewritten.
  The frontend and `backend/` are separate npm packages, each with its own lockfile.

### Browser support

Builds target Vite's default baseline: Chrome/Edge 111+, Firefox 114+, Safari/iOS 16.4+.
Some enhancements need newer browsers and degrade gracefully: the account menu uses the
Popover API where available (Chrome 114, Firefox 125, Safari 17) and a built-in fallback elsewhere;
dialog and menu entry animations (`@starting-style`) are skipped by older browsers.

## Scripts

Frontend (repository root):

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the dev server                     |
| `npm run build`     | Type-check (`tsc -b`) and production build (incl. service worker and manifest) |
| `npm run verify:pwa`| Check the PWA output in `dist/` (manifest, icons, caching rules); run after `build` |
| `npm run typecheck` | Strict TypeScript check only             |
| `npm run lint`      | Run ESLint (includes import-boundary rules) |
| `npm test`          | Run unit tests once (Vitest)             |
| `npm run test:watch`| Run tests in watch mode                  |
| `npm run preview`   | Preview the production build (service worker active; `/api` forwarded to the backend) |

Backend (run inside `backend/`):

| Command             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start the API with reload on change (`tsx watch`)  |
| `npm run build`     | Compile to `backend/dist/`                         |
| `npm start`         | Run the compiled API (`node dist/server.js`)       |
| `npm run typecheck` | Strict TypeScript check (source and tests)         |
| `npm run lint`      | Run ESLint                                         |
| `npm test`          | Run API tests once (no database needed)            |

## Structure

```
src/
├── app/            App.tsx, router.tsx, providers/ (AppProviders, ThemeProvider), pwa/ (service worker updates)
├── pages/          Thin route entry points
├── features/       Feature modules: auth, dashboard, workouts, nutrition, ai-coach, progress
├── components/
│   ├── ui/         Design system components
│   ├── layout/     App shell (sidebar, bottom navigation, header) and public layout
│   └── feedback/   Error boundary, error alert and loading states
├── hooks/          Shared hooks and shared-state contexts (useTheme, usePersistentState)
├── services/       Shared data access: typed API client (services/api)
├── types/          Shared types; domain models in types/models/
├── utils/          Pure helpers (storage, cn, createStrictContext)
├── constants/      Routes, navigation config, theme keys
├── styles/         Tailwind entry + design tokens
├── dev/            Development-only tools (/design-system)
├── test/           Test setup and cross-cutting tests
└── main.tsx

public/             Favicon and PWA icons (192, 512, maskable 512, Apple touch 180)
pwa.config.ts       Web app manifest and service worker caching rules (tested in pwa.config.test.ts)
scripts/            verify-pwa.mjs (post-build PWA checks)

backend/
├── src/
│   ├── app.ts          Express app factory (middleware, routes; no I/O)
│   ├── server.ts       Entry point: config → database → listen → graceful shutdown
│   ├── config/         Environment validation (env.ts)
│   ├── database/       Mongoose connection lifecycle and status
│   ├── middleware/     Request id, 404 and error handlers
│   ├── routes/         HTTP routes (health.ts)
│   └── utils/          Logger with secret redaction, HttpError, graceful shutdown
├── tests/              Vitest tests (real HTTP on an ephemeral port; no Atlas required)
└── .env.example
```

Architecture, layer rules, state management, the API layer, error/loading handling, the backend
and the database design: [docs/architecture.md](docs/architecture.md).

## Environment

### Frontend (`.env.local` in the repository root)

The app runs without any environment variables; API calls then fail with a clear configuration error.

```bash
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | API base URL. Use `/api` (same origin; the dev server proxies it to the backend), or an absolute URL such as `https://api.example.com/api` (https required in production). |
| `DEV_API_PROXY_TARGET` | Development only, read by `vite.config.ts`, never sent to the browser. Where `/api` is forwarded. Default `http://localhost:3000`. |

`VITE_*` variables are embedded in the browser bundle and are public. Never put secrets in them,
and never put backend variables (such as `MONGODB_URI`) in a `VITE_*` variable.
`.env.local` and other `.env.*` files are git-ignored; only `.env.example` is committed.

### Backend (`backend/.env`)

```bash
cd backend
cp .env.example .env         # PowerShell: Copy-Item .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string (`mongodb+srv://…` for Atlas). Secret. |
| `PORT` | No | HTTP port, default `3000`. |
| `NODE_ENV` | No | `development` (default), `test` or `production`. |
| `CORS_ORIGIN` | In production | Comma-separated exact browser origins allowed to call the API. Development default: `http://localhost:5173`. In production every entry must be `https`; `*` is never accepted. |

The server validates all variables at start-up, prints every problem (never secret values) and exits
with code 1 if anything is wrong. `backend/.env` is loaded with Node's built-in `process.loadEnvFile`
only if it exists (run the scripts from `backend/`); in production, set variables in the hosting environment.

Imports use the `@/` alias for `src/`.

## Local development

```bash
# terminal 1 – API (needs backend/.env with a valid MONGODB_URI)
cd backend && npm ci && npm run dev

# terminal 2 – frontend (repository root, VITE_API_BASE_URL=/api in .env.local)
npm ci && npm run dev
```

Check the API: `GET http://localhost:3000/api/health`, or through the frontend dev server:
`http://localhost:5173/api/health`. It returns `200 {"status":"ok","database":"connected",…}` when MongoDB
is connected and `503 {"status":"degraded",…}` otherwise.

## MongoDB Atlas setup

The API has been tested without a real Atlas cluster (all tests run without a database).
To connect one:

1. Create a cluster in [MongoDB Atlas](https://cloud.mongodb.com) (the free M0 tier is enough for development).
2. **Database Access:** add a database user with a strong generated password and the
   *Read and write to any database* role (or, better, `readWrite` on the `fitness_ai` database only).
3. **Network Access:** add your current IP address for development. For production, add only the
   outbound IPs of your hosting provider. Avoid `0.0.0.0/0`; if the host has no fixed IPs and you must use
   it, rely on the strong password and rotate it regularly.
4. **Connect → Drivers:** copy the `mongodb+srv://` string, insert the user and password
   (URL-encode special characters, e.g. `@` → `%40`) and add the database name after the host:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/fitness_ai?retryWrites=true&w=majority`
5. Put it in `backend/.env` as `MONGODB_URI=…` and run `npm run dev` in `backend/`.
   The log shows `MongoDB connected` and `API listening`; `/api/health` returns 200.

If start-up fails with `could not connect to MongoDB`, check the IP access list, the user name and password,
and the cluster host. The database is only reached by the backend, never from the browser.

## Install on a phone (PWA)

Fitness AI installs from its HTTPS address, without an app store:

- **iPhone (Safari):** Share → **Add to Home Screen** → keep *Open as Web App* on → **Add**.
- **Android (Chrome):** ⋮ menu → **Install app** (or *Add to Home screen*).

The app then opens in its own window, starts offline from a cached app shell, and offers new versions
with a "Reload to update" notice. API data always needs a connection and is never cached.
The service worker only runs in production builds (`npm run build` + `npm run preview`), never in `npm run dev`.
Details, limitations and test results: [docs/fit-9-pwa-qa-report.md](docs/fit-9-pwa-qa-report.md).

## Deployment

**Frontend.** The output in `dist/` is a static single-page app. Configure the host to serve `index.html`
for any unknown path (history API fallback); otherwise reloading a deep link such as `/settings` returns 404.
`npm run preview` already behaves this way. Set `VITE_API_BASE_URL` at build time (see Environment).
Serve over **HTTPS** (required for the service worker and installation) at the site root, and send
`Cache-Control: no-cache` for `sw.js`, `index.html` and `manifest.webmanifest` (hashed files in `assets/` can be
cached for a year, `immutable`). See section 7 of the FIT-9 QA report.

**Backend prerequisites.**

- A Node.js host (22.22.2+ or 24.15.0+) that runs `npm ci && npm run build` and `npm start` in `backend/`,
  sends `SIGTERM` before stopping the process (the server then finishes in-flight requests within 10 s),
  and terminates TLS (serve the API only over https).
- Environment variables set in the host: `NODE_ENV=production`, `MONGODB_URI`, `CORS_ORIGIN`
  (the frontend's https origin) and usually `PORT` (many hosts provide it).
- Atlas network access allowing the host's outbound IPs.
- Health check path: `/api/health` (503 while the database is unavailable).
- Routing, choose one:
  - **Same origin (recommended):** the frontend host or a reverse proxy forwards `/api/*` to the backend;
    build the frontend with `VITE_API_BASE_URL=/api`. No CORS involved.
  - **Separate API domain:** build with `VITE_API_BASE_URL=https://api.example.com/api` and set
    `CORS_ORIGIN=https://app.example.com` on the backend.
- In production, indexes are not built automatically (`autoIndex` off); create them deliberately when models exist.
- If the API runs behind a proxy and later needs client IPs (e.g. rate limiting), configure Express `trust proxy`.

## Notes

- TypeScript is pinned to 6.0 in both packages because `typescript-eslint` does not yet support TypeScript 6.1+.
- Dark mode is class-based (`dark` class on `<html>`); the primary accent maps to Tailwind's lime palette (`primary-*`).
- Future mobile bottom navigation order is defined in `src/constants/navigation.ts`.
