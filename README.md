# Fitness AI

Responsive fitness application (desktop and mobile): a React frontend (repository root), a REST API in
[`backend/`](backend) with email/password accounts, and a Cloudflare Worker ([`worker/`](worker)) that serves the app
and forwards `/api` in production. The frontend is an installable Progressive Web App
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
| `CORS_ORIGIN` | In production | Comma-separated exact origins of the app (CORS and the CSRF allowlist). Development default: `http://localhost:5173`. In production every entry must be `https`; `*` is never accepted. |
| `TRUST_PROXY_HOPS` | In production | Number of reverse proxies in front of the API whose `X-Forwarded-For` entries are trusted (client IP for rate limiting). Default `0` (local). Render: `1`. |
| `PROXY_SECRET` | In production | Shared secret with the Cloudflare Worker (≥ 32 characters). When set, every request except `GET /api/health` must carry it, so the API is only reachable through the app. Secret. |

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

## Authentication

Email and password accounts (FIT-11). Passwords are hashed with Argon2id. The session is a server-side
record in MongoDB referenced by an `HttpOnly`, `Secure`, `SameSite=Strict` cookie (`__Host-fa_session`), valid
for 14 days. Nothing auth-related is stored in `localStorage` or readable by JavaScript.
Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`PATCH /api/users/me`. All app pages except Log in and Create account require a session.
Design, security decisions and test results: [docs/fit-11-auth-qa-report.md](docs/fit-11-auth-qa-report.md).

The API must be **same-origin** with the app for the cookie to work (Safari blocks third-party cookies):
`/api` through the Vite proxy locally, and through the Cloudflare Worker in production.

Backend tests use a throwaway local MongoDB (`mongodb-memory-server-core`), never Atlas: the first run downloads
a `mongod` binary (~100 MB, cached), or set `MONGOMS_SYSTEM_BINARY` to an installed `mongod`.

## Deployment

Public preview hosting: **Cloudflare Workers** (static assets + a small Worker for `/api`) and **Render**
(API, free web service), with MongoDB Atlas. Secrets live only in the hosts' dashboards.
Procedures and verification: [FIT-10 report](docs/fit-10-deployment-qa-report.md) (Render, Atlas, security headers) and
[FIT-11 report](docs/fit-11-auth-qa-report.md) (Workers proxy, authentication), which supersedes FIT-10's frontend hosting.

**Frontend (Cloudflare Workers, `wrangler.jsonc`).** Build command `npm run build` with `VITE_API_BASE_URL=/api`,
deploy command `npx wrangler deploy`. Static files are served by Workers static assets (free, unlimited);
only `/api/*` runs `worker/index.ts`, which forwards to Render with the shared `PROXY_SECRET` (a Worker secret)
and the visitor's IP. `API_ORIGIN` in `wrangler.jsonc` must be the Render URL. The build writes `dist/_headers`
(`deploy/security-headers.ts`): a Content Security Policy allowing only this site and the hashed inline theme script,
plus HSTS, frame blocking and caching rules (`sw.js`/`index.html` always revalidated, hashed assets immutable).
`html_handling: "none"` keeps `/index.html` servable for the service worker; unknown paths get `index.html` (SPA fallback).

**Backend (Render, `render.yaml`).** `rootDir: backend`, free plan, Frankfurt, `npm ci --include=dev && npm run build`,
`npm start`, health check `/api/health`, `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`. `CORS_ORIGIN` (the Worker
origin), `MONGODB_URI` and `PROXY_SECRET` are entered in the Render dashboard (`sync: false`), never committed.
The API refuses to start without them, without TLS to MongoDB, or with `*`/http origins in production. It creates
its indexes (unique email, session token, session expiry) at start-up.

**Other hosts** need the same: HTTPS, the app and `/api` on one origin, the `_headers` rules (or equivalent),
`NODE_ENV=production`, `MONGODB_URI`, `CORS_ORIGIN`, `PROXY_SECRET` (or another way to restrict direct access),
the correct `TRUST_PROXY_HOPS`, Atlas network access for the API's outbound IPs, and `SIGTERM` before stopping the API.

## Notes

- TypeScript is pinned to 6.0 in both packages because `typescript-eslint` does not yet support TypeScript 6.1+.
- Dark mode is class-based (`dark` class on `<html>`); the primary accent maps to Tailwind's lime palette (`primary-*`).
- Future mobile bottom navigation order is defined in `src/constants/navigation.ts`.
