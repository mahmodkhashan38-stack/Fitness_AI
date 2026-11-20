# Fitness AI — Architecture

Status: FIT-11. Sections 1–6 describe the frontend: how the code is organised, where state lives,
how the app talks to the API, and how errors and loading states are handled. Sections 7–8 describe
the backend foundation (`backend/`) and the planned database design. Section 9 describes the
Progressive Web App layer (installation, service worker, offline and updates). Section 10 describes
authentication and sessions.

> The backend provides `GET /api/health` and authentication (FIT-11). There are no product data
> endpoints yet.

## 1. Folder structure and layers

```
src/
├── app/          App entry: providers, router, route layouts wiring
├── pages/        Thin route entry points (one per route)
├── features/     Feature modules (code used by one feature only)
├── components/   Shared UI: design system (ui/), app shell (layout/), error & loading (feedback/)
├── hooks/        Shared hooks and shared-state contexts (e.g. useTheme)
├── services/     Shared data access: the API client (services/api)
├── utils/        Pure helpers (storage, cn, createStrictContext …)
├── constants/    Static config (routes, navigation, theme keys)
├── types/        Shared TypeScript types, incl. domain models (types/models)
├── styles/       Tokens, Tailwind theme, base styles
├── dev/          Development-only tools (/design-system); never in production
└── test/         Test setup and cross-cutting tests
```

### Dependency direction

A layer may import only from layers **below** it:

```
app → pages → features → components → hooks → services → utils / constants / types
```

- `features/<name>` must not import from another feature. Code needed by two
  features moves down to `components/`, `hooks/`, `utils/` or `types/`.
- Shared layers (`components`, `hooks`, `utils` …) never import feature, page or app code.
- `dev/` may use anything except `app/`, and nothing may import `dev/`
  (except the router's development-only lazy route).
- Imports across folders use the `@/` alias; `../` imports are not allowed.

These rules are **enforced by ESLint** (`no-restricted-imports` in `eslint.config.js`),
so `npm run lint` fails on a violation.

### Feature modules

Each feature grows the same shape, creating folders only when there is code for them:

```
features/workouts/
├── components/   UI used only by this feature
├── hooks/        Feature state and data hooks (e.g. useWorkoutLog)
├── services/     Feature API calls (FIT-5)
├── types/        Feature-only types (shared domain models stay in types/models)
└── utils/        Feature-only helpers
```

Planned features: `dashboard`, `workouts`, `nutrition`, `progress`, `ai-coach`,
`auth`, and `account` (Profile and Settings; the folder is created with its first code).
Route pages in `pages/` stay thin and compose feature components.

Avoid barrel files (`index.ts`) inside features; import the file you need.
`components/ui/index.ts` is the one public barrel, for the design system.

## 2. State management strategy

Built-in React only. No Redux, Zustand, MobX or React Query until a concrete need appears.

| Kind of state | Where it lives | Tools |
|---|---|---|
| **Local UI state** (open/closed, form input, selected tab) | The component that uses it | `useState`; `useReducer` when there are several related transitions |
| **Shared client state** (theme, later e.g. unit preference) | One small context per concern, created with `createStrictContext` | Context + custom hook (`useTheme`) |
| **Persisted preferences** (non-sensitive) | localStorage, through `usePersistentState` | `utils/storage.ts` |
| **Server state** (workouts, meals, messages) | Feature hooks calling feature services (built on `apiClient`), close to where data is used | Not global context |

Rules:

1. Start local. Lift state up only as far as the nearest common parent.
2. Add a context only when unrelated parts of the tree need the same state.
   One concern per context; never one giant app context.
3. Memoise context values (`useMemo`) and keep setters stable (`useCallback`), so only
   consumers re-render. Split a context into state and actions if updates become frequent.
4. Mount a provider at the narrowest scope that needs it: app-wide providers go in
   `app/providers/AppProviders.tsx`; feature-wide providers are mounted by that feature's route/layout.
5. Do not put API responses in global context. Server data is cached, refetched and
   invalidated differently. Feature hooks call feature services directly for now;
   adopting TanStack Query is reasonable once caching/deduplication is actually required.
6. Never persist sensitive data (tokens, passwords, health records, personal details)
   in localStorage.

### Providers

`app/App.tsx` → `AppProviders` → `RouterProvider`.

`AppProviders` currently holds only `ThemeProvider`. Providers in it cannot use router hooks,
because the router renders inside them; providers that need routing go in a route layout
such as `AppShell`.

### Theme (reference implementation)

- Context + hook: `hooks/useTheme.ts` (shared layer, usable by shared components).
- Provider: `app/providers/ThemeProvider.tsx` — preference via `usePersistentState`
  (key `fitness-ai-theme`, stored as a plain string), OS preference via `useSyncExternalStore`.
- `index.html` contains a tiny inline script that applies the saved theme before React loads.
  Its storage key and value format must stay in sync with `constants/theme.ts`.

## 3. API layer

Files in `src/services/api/`:

| File | Purpose |
|---|---|
| `client.ts` | `createApiClient()` factory and the shared `apiClient` instance |
| `errors.ts` | `ApiError` (the only error type the client throws) and `isApiError` |
| `config.ts` | Reads and validates `VITE_API_BASE_URL` |
| `types.ts` | `HttpMethod`, `QueryParams`, `ApiRequestOptions`, `ApiClient` … |
| `health.ts` | `fetchApiHealth()` and `parseApiHealth()` for `GET /api/health` (first real endpoint) |

Built on native `fetch`, with no HTTP library, no automatic retries and no global auth.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | Only when calling the API | Absolute `http(s)` URL or same-origin path (`/api`). Trailing slashes are removed. |

- **Development:** copy `.env.example` to `.env.local` (git-ignored); it sets `VITE_API_BASE_URL=/api`.
  `vite.config.ts` proxies `/api` to the backend (`DEV_API_PROXY_TARGET`, default `http://localhost:3000`),
  so the browser sees a single origin and CORS is not involved. Calling `http://localhost:3000/api`
  directly also works because the backend's development `CORS_ORIGIN` default is `http://localhost:5173`.
- **Production:** set the variable in the build environment (`.env.production.local` or the CI/hosting settings).
  It must be `https` (local hosts excepted) or a same-origin path. It is baked in at **build time**.
- **Not set:** the app runs normally; API calls reject with `ApiError` `kind: 'config'`.
  The value is read per request, never at start-up, so a missing value cannot break the placeholder UI.
- Rejected values: anything that isn't http(s) or a `/path`, URLs with credentials, query strings or hashes,
  protocol-relative `//host`, and plain `http` in production builds.

> **Security:** every `VITE_*` variable is public, embedded in the JavaScript sent to browsers.
> Never put secrets, API keys, database credentials or private tokens in them. `.env`, `.env.*`
> and `*.local` are git-ignored; only `.env.example` (no real values) is committed.

### Usage

```ts
import { apiClient } from '@/services/api/client'

// GET with query parameters, cancellation and runtime validation
const workouts = await apiClient.get('/workouts', {
  query: { from: '2026-11-01', tag: ['strength', 'push'] }, // ?from=…&tag=strength&tag=push
  signal: controller.signal,
  parse: parseWorkoutList, // (data: unknown) => Workout[]; throws if invalid
})

// POST a JSON body
const created = await apiClient.post<{ id: string }>('/workouts', { body: { name: 'Push Day' } })

// No-content endpoints resolve to undefined
await apiClient.delete<void>(`/workouts/${id}`)
```

Request options: `query`, `headers`, `body` (JSON), `signal`, `timeoutMs`, `parse`.
Paths must start with `/` and are relative to the base URL; absolute URLs are refused so requests
(and, later, auth headers) can never be sent to another origin.

**Typing:** `get<T>()` without `parse` is an *unchecked* assumption about what the server returns.
Pass `parse` to validate at runtime; a failed parser becomes a `parse` error.

### Responses

| Response | Result |
|---|---|
| 2xx with JSON content type (`application/json`, `*+json`) | Parsed JSON (then `parse`, if given) |
| 204/205, or 2xx with an empty body | `undefined` |
| 2xx with another or missing content type | `ApiError` `parse` |
| 2xx with malformed JSON | `ApiError` `parse` |
| Non-2xx | `ApiError` `http`, with `status` and `body` (JSON if declared, else text ≤ 2 000 chars) |

### Errors

Every failure rejects with `ApiError`; branch on `error.kind`:

| kind | Meaning | Typical handling |
|---|---|---|
| `http` | Server replied with an error status (`status`, `body`; `isClientError` / `isServerError`) | 4xx: show validation/auth message. 5xx: unexpected |
| `network` | No response (offline, DNS, CORS) | Expected on mobile; offer retry |
| `timeout` | Client timeout elapsed | Offer retry |
| `aborted` | Caller cancelled via `signal` | Usually ignore (e.g. user navigated away) |
| `parse` | Response not valid JSON / wrong shape | Unexpected: contract mismatch |
| `config` | Missing/invalid base URL or invalid path | Programming/deployment error |

Error messages contain only the method, path and status. Query values, headers and request bodies
are never included, and the client never logs. How errors are shown to users is FIT-6.

### Timeout and cancellation

- Default timeout: 15 s (`DEFAULT_TIMEOUT_MS`), per client (`createApiClient({ timeoutMs })`) or
  per request (`timeoutMs`). `0` disables it. The timeout covers reading the response body too.
- `signal` cancels a request. A signal that is already aborted rejects immediately without calling `fetch`.
- Timeout and cancellation share one internal `AbortController`; the client records which one fired,
  so they are reported as `timeout` and `aborted` respectively.
- Requests are never retried automatically.

### Writing a feature service

Services live in the feature that owns them (e.g. `features/workouts/services/workout-service.ts`),
are created only when a real endpoint exists, and stay small and typed:

```ts
import { apiClient } from '@/services/api/client'
import type { Workout } from '@/types/models/workout'

export function listWorkouts(range: { from?: string }, signal?: AbortSignal): Promise<Workout[]> {
  return apiClient.get('/workouts', { query: range, signal, parse: parseWorkouts })
}
```

Components and pages don't call `apiClient` directly; feature hooks call services.

### Authentication (not implemented)

There is no token handling. The client adds no `Authorization` header; a caller can pass headers
explicitly. Token storage, refresh and attaching credentials will be designed in the Authentication sprint.

### Current limitations

- JSON-only: request bodies are always JSON (no `FormData` uploads yet, e.g. for food photos);
  successful responses must be JSON or empty.
- No retries, request deduplication or caching. For user-facing errors see section 4.
- `fetch` default credentials (`same-origin`); cookie vs. token auth is undecided.
- The only endpoint is `GET /api/health` (`fetchApiHealth`); no screen calls it yet.
  It resolves for `200` (`status: 'ok'`) and for `503` (`status: 'degraded'`: API up, database down)
  and throws `ApiError` otherwise.

## 4. Errors and loading

### Error boundaries

`components/feedback/ErrorBoundary.tsx` is a small class component (no library). It catches errors
thrown **while rendering** its children (render, lifecycle methods, constructors) and shows a fallback.
Props: `fallback` (element or `({ error, reset }) => ReactNode`), `resetKeys`, `onError`, `onReset`.

Error boundaries do **not** catch:
- errors in event handlers (`onClick` …);
- asynchronous errors (promises, `fetch`, timers), including everything from `apiClient`;
- errors in the boundary itself, or during server rendering.

Handle those with `try/catch` or `useAsyncTask` and show them with `<ErrorAlert>` (below).

Where boundaries are placed (three layers, not one per component):

| Layer | Where | Catches | User sees |
|---|---|---|---|
| Page content | `RouteContentBoundary` around `<Outlet/>` in AppShell and PublicLayout | A page crashing while rendering | Fallback **inside** the shell (navigation keeps working) with *Try again* and *Go to Dashboard*. Navigating to another path resets it. |
| Layout routes | `errorElement: <RouteErrorFallback/>` on both layout routes | A layout crashing; future loader/action errors | Full-page fallback with *Reload page* and *Go to Dashboard*. Replaces React Router's default screen, which showed stack traces. |
| App | `ErrorBoundary` in `App.tsx` around providers + router | Anything above the routes (e.g. a provider) | Full-page "couldn't start" with *Reload page*. |

Why both a content boundary and `errorElement`: React Router's error state cannot be cleared for a render
error by re-navigating to the same URL, so a router fallback can't offer a working *Try again*. The class
boundary can (it simply re-renders), while `errorElement` remains the safety net for layouts and loaders.

Fallbacks (`ErrorFallback`) never show error details in production. In development a collapsed
"Technical details" panel shows only `name: message` (no stack). React itself still reports caught errors
to the browser console for developers; a future monitoring service would hook into `onError` or
React's `createRoot` `onCaughtError`, and must not send personal data. Route and app fallbacks move focus
to themselves so keyboard and screen-reader users notice the change.

Use additional boundaries sparingly, for independent sections of a future screen (e.g. a chart that may fail
while the rest of the dashboard works): `<ErrorBoundary><Chart/></ErrorBoundary>`.

### Recoverable errors (API and async)

```
ApiError / unknown error ──getErrorFeedback()──▶ ErrorFeedback ──▶ <ErrorAlert>
      (services/api)                             (types/feedback)   (components/feedback)
```

- `getErrorFeedback(error)` (in `services/api/error-feedback.ts`) maps any thrown value to fixed, safe copy:
  `{ title, message, canRetry, severity }`. It never includes the error message, URL, status code or
  response body. It returns **`null` for intentional cancellations** (`ApiError` `aborted`, `AbortError`):
  show nothing for those.

  | Error | Title | Retry |
  |---|---|---|
  | `network` | You appear to be offline | yes |
  | `timeout` | This is taking too long | yes |
  | `http` 400/422 | Something needs your attention | no |
  | `http` 401 / 403 / 404 | Please sign in again / Access denied / Not found | no |
  | `http` 408, 429 | Please wait a moment | yes |
  | `http` 5xx | Something went wrong on our side | yes |
  | `parse` | Unexpected response | yes |
  | `config` | Not available yet | no |
  | other `Error`s | Something went wrong | yes |

- `<ErrorAlert feedback onRetry? retrying? onDismiss?>` renders an announced (`role="alert"`) Alert.
  The *Try again* button appears only when an `onRetry` callback is given **and** the error is retryable.
  Nothing retries automatically. Shared UI only knows the `ErrorFeedback` type, not the API layer.
- Field-level validation messages (e.g. from a 422 body) are the responsibility of the feature's form,
  which can read `ApiError.body` and map it explicitly.
- There is no global toast system; errors are shown next to the content they affect.

### Async state

`types/async.ts`:

```ts
type AsyncState<T> =
  | { status: 'idle' } | { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: unknown }
```

`hooks/useAsyncTask(task)` returns `{ state, run, retry, cancel, reset }`. The task receives an
`AbortSignal` (pass it to `apiClient`).

- **Latest call wins:** `run` aborts the previous call; late results of superseded calls are ignored.
- **No stale state:** starting a call clears the previous error/data; success never shows an old error.
- **Cancellation:** `cancel()` aborts and returns to `idle`, never `error`.
- **Unmount:** the running call is aborted and no state is set afterwards.
- **Retry:** `retry()` re-runs with the last arguments, only when called (e.g. from *Try again*).
- `run` never rejects; errors live in `state`.

```tsx
const { state, run, retry } = useAsyncTask((signal, range: Range) => listWorkouts(range, signal))
useEffect(() => { void run(range) }, [run, range])
const feedback = state.status === 'error' ? getErrorFeedback(state.error) : null

<section aria-busy={state.status === 'loading'}>
  {state.status === 'loading' && <LoadingState label="Loading workouts…" />}
  {feedback && <ErrorAlert feedback={feedback} onRetry={retry} />}
  {state.status === 'success' && <WorkoutList workouts={state.data} />}
</section>
```

This hook is intentionally small (no caching, deduplication or background refetch). If several screens
need shared, cached server data, adopt a data-fetching library then, rather than growing this hook.

### Loading patterns

| Need | Use |
|---|---|
| Inline ("Saving…" next to content) | `<LoadingState variant="inline" />` |
| A section/card | `<LoadingState variant="section" />` (reserves height) or `<Skeleton>` shapes matching the final layout |
| Main content area | `<LoadingState variant="page" />` (also used by `RouteLoader`) |
| A button action | `<Button loading loadingText="Saving…">` (stays focusable, `aria-busy`) |

Rules: one indicator per region (don't combine a skeleton and a spinner for the same content); set
`aria-busy="true"` on the region being loaded; `LoadingState` provides a single polite status message
(the spinner is decorative); skeletons are `aria-hidden`, so pair them with an `sr-only` status text.
All spinners and skeleton pulses stop animating under `prefers-reduced-motion` (rule in `styles/base.css`).

### Route loading (decision)

Feature routes are **not** lazy-loaded. The pages are small placeholders; splitting them would add a network
round-trip and a loading flash on every first visit without reducing the initial bundle meaningfully
(it is dominated by React, React Router and icons). Revisit per route when a screen pulls in heavy code
(e.g. a charting library). The development-only `/design-system` route stays lazy (with `RouteLoader`)
so it never reaches production.

### Responsibilities of future feature screens

- Fetch through a feature service + `useAsyncTask` (or a data library later); pass the `signal`.
- Show loading with the patterns above; show errors with `getErrorFeedback` + `ErrorAlert`.
- Provide *Try again* only when repeating the action makes sense; never auto-retry.
- Don't show cancellations; don't show raw error messages, status codes or response bodies.
- Wrap independently failing sections in their own `ErrorBoundary` only when useful.

## 5. Domain models

`src/types/models/` holds preliminary frontend contracts (not final backend schemas):
`User`, `Workout` / `Exercise` / `ExerciseSet`, `NutritionEntry`, `BodyMeasurement`, `CoachMessage`.

- Units are canonical metric and explicit in field names: `weightKg`, `heightCm`,
  `caloriesKcal`, `proteinG`. Convert for display only.
- Dates: `IsoDate` (`YYYY-MM-DD`) for calendar days, `IsoDateTime` for instants.
- Import models from their file, e.g. `import type { Workout } from '@/types/models/workout'`.

## 6. Testing

`npm test` runs Vitest (jsdom + React Testing Library). Tests sit next to the code they cover
(`*.test.ts(x)`); cross-cutting examples live in `src/test/`. Test-only components never ship.
API tests mock `fetch` (injected or stubbed); no test touches the network.

jsdom does not implement `<dialog>.showModal()` or the Popover API. Dialog tests stub `showModal`/`close`
and test the component's own logic; component tests in jsdom therefore exercise the account menu's
non-popover fallback. Native behaviour (focus trapping, top layer, popover light-dismiss) and layout,
contrast and responsiveness were verified in a real browser during Sprint 1 QA
(see `docs/sprint-1-qa-report.md`); those browser checks are not yet part of the repository.

Use `element.click()` rather than `fireEvent.click` to assert that a *disabled* control can't be toggled:
`fireEvent` dispatches a synthetic event that browsers deliver even to disabled inputs.

## 7. Backend

`backend/` is a separate npm package (own `package.json`, lockfile, `tsconfig`, ESLint and Vitest config;
the root ESLint config ignores it). ESM, TypeScript strict with `NodeNext` resolution, Express 5.

### Structure and request flow

| Path | Responsibility |
|---|---|
| `src/server.ts` | Entry point: load `.env` (dev), validate config, connect MongoDB, listen, register shutdown handlers |
| `src/app.ts` | `createApp({ config, getDatabaseStatus, logger })`: builds the Express app with no I/O, so tests run it without a database |
| `src/config/env.ts` | `loadConfig(env)` → typed `AppConfig`; throws `ConfigError` listing every problem |
| `src/database/connection.ts` | `connectDatabase`, `disconnectDatabase`, `getDatabaseStatus` (shared Mongoose connection) |
| `src/middleware/` | `requestId`, `notFound`, `errorHandler(logger)` |
| `src/routes/health.ts` | `GET /api/health` |
| `src/utils/` | `logger` (JSON lines, redaction), `redactSecrets`, `HttpError`, `createGracefulShutdown` |

Middleware order: request id → Helmet → CORS → rate limit → `express.json({ limit: '100kb' })` → `/api` routes → 404 → error handler.

`controllers/`, `services/` and `models/` are intentionally not created yet: there is one route and no
data model. When feature endpoints arrive, use `routes/` (HTTP wiring and input validation) →
`services/` (business rules, always scoped by user id) → `models/` (Mongoose schemas).

### API conventions

- All endpoints live under `/api`. JSON in and out.
- Errors always have the shape `{ "error": { "code": "NOT_FOUND", "message": "…", "requestId": "…" } }`.
  `code` is stable and machine-readable; `message` is safe to show; `requestId` matches the
  `X-Request-Id` response header and the server logs.
- Throw `HttpError(status, code, message)` for expected failures. Any other error becomes
  `500 INTERNAL_ERROR` with a generic message and is logged.

| Situation | Status | Code |
|---|---|---|
| Unknown route or method | 404 | `NOT_FOUND` |
| Malformed JSON body (or a non-object/array root) | 400 | `INVALID_JSON` |
| Body over 100 KB | 413 | `PAYLOAD_TOO_LARGE` |
| Unsupported `Content-Encoding` / charset | 415 | `UNSUPPORTED_ENCODING` |
| More than 120 requests per minute from one client IP | 429 (+ `Retry-After`) | `RATE_LIMITED` |
| Unexpected error | 500 | `INTERNAL_ERROR` |

`GET /api/health` → `{ status: 'ok' | 'degraded', database: 'connected' | 'connecting' | 'disconnecting' | 'disconnected', timestamp, uptimeSeconds }`,
`200` when the database is connected, otherwise `503`, with `Cache-Control: no-store`. It reveals no
hostnames, versions or configuration. It is both the liveness check and the readiness check; split them
if a host ever needs a liveness probe that ignores the database.

### Lifecycle

- **Start-up:** invalid configuration → all problems logged, exit code 1. MongoDB unreachable within 10 s
  (server selection timeout) → redacted error logged, exit code 1. The server only listens after the
  database is connected, so it never serves traffic it cannot handle.
- **Runtime:** Mongoose reconnects automatically; `connected` / `disconnected` / `reconnected` / `error`
  events are logged, and `/api/health` reports the current state.
- **Shutdown:** on `SIGTERM`/`SIGINT` the server stops accepting connections, closes idle keep-alive
  connections, waits for in-flight requests, disconnects MongoDB and exits 0. After 10 s the remaining
  connections are destroyed and it exits 1. `unhandledRejection` and `uncaughtException` are logged and
  trigger the same shutdown with exit code 1. Repeated signals are ignored.

### Security decisions

- **Helmet** with an API-only CSP (`default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`),
  `nosniff`, HSTS, frame protection; `X-Powered-By` disabled. (The frontend's own CSP is generated at build time,
  see README → Deployment.)
- **CORS allowlist:** only exact origins from `CORS_ORIGIN`; never `*`, never reflected. `https` only in
  production. Credentials (cookies) are not allowed until the authentication design decides otherwise.
  Requests without an `Origin` header (curl, server-to-server) are not CORS requests and are unaffected;
  CORS is a browser protection, not access control. Authorization will be enforced per request.
- **Body limits:** JSON only, 100 KB, strict parsing (objects and arrays only). Raise per route if needed.
- **Input validation:** the only endpoint takes no input. Incoming `X-Request-Id` is reused only if it
  matches `^[A-Za-z0-9-]{8,64}$`, otherwise replaced (prevents log injection). Configuration is validated
  at start-up. Each future endpoint must validate its body, params and query before use.
- **Safe errors:** responses never include stack traces, internal messages or the requested path;
  the same in every environment.
- **Secrets:** `MONGODB_URI` is read only on the server, never logged, and never echoed in config errors.
  The logger redacts credentials in URLs (`mongodb+srv://***:***@…`) and `password=`/`token=`-style
  values in every message, field and stack. Logs omit query strings, bodies and headers.
  `.env` is git-ignored; `backend/.env.example` has no real values. The browser never talks to MongoDB.
- **Mongoose:** `strictQuery` enabled (unknown filter fields are dropped); `autoIndex` off in production.
- **Rate limiting** (`middleware/rate-limit.ts`, `express-rate-limit`): 120 requests per minute per client IP on
  every route (unknown routes included), JSON `429 RATE_LIMITED` with `Retry-After` and IETF `RateLimit` headers
  (exposed to allowed origins). In-memory store: correct for one instance; a shared store is needed when scaling out.
  Future sensitive endpoints (login, AI) need their own, stricter limits.
- **Client IP / `trust proxy`:** `TRUST_PROXY_HOPS` (required in production; Render `1`) is passed to Express as a
  hop count, never `true`. `req.ip` is then the address appended by the nearest trusted proxy, so a client sending
  its own `X-Forwarded-For` cannot choose its rate-limit identity (tested for 0 and 1 hop).
- **MongoDB TLS:** production requires `mongodb+srv://` or `tls=true`; `tls=false`, `ssl=false`, `tlsInsecure` and
  `tlsAllowInvalid*` are rejected in every environment.
- Not yet in place (decide with the features that need them): authentication and authorization.

### Testing

`cd backend && npm test`. Tests start the real Express app on an ephemeral port and use `fetch`, so headers,
body parsing and CORS are exercised end to end. Database failure is tested with a real Mongoose connection
to a closed port; start-up failures run `src/server.ts` as a child process. No test needs MongoDB Atlas.
A successful connection to a real database is not covered by automated tests (see README for manual setup).

## 8. Database design (planned)

Only the connection exists. No models are implemented yet; each is added with the feature that uses it.
The design follows the frontend contracts in `src/types/models/`.

### Conventions

- **Ownership and isolation:** every user-owned document has a required, indexed `userId` (`ObjectId`).
  The id always comes from the authenticated session, never from the request body or query. Services take
  `userId` as a required argument and include it in every filter (`findOne({ _id, userId })`), so another
  user's document is indistinguishable from a missing one (404, not 403). Compound indexes start with `userId`.
- **Ids:** MongoDB `ObjectId`; exposed to the API as the string `id` (the frontend `EntityId`).
  Responses are mapped explicitly; `_id`, `__v` and secrets such as password hashes are never returned.
- **Timestamps:** Mongoose `timestamps: true` (`createdAt`, `updatedAt`, UTC) on every collection.
- **Dates:** instants (`IsoDateTime`) are stored as BSON `Date` (UTC). Calendar days (`IsoDate`) are stored
  as `YYYY-MM-DD` strings in the user's local calendar, so a day never shifts with time zones.
- **Units:** stored in canonical metric units named in the field (`weightKg`, `heightCm`, `caloriesKcal`,
  `proteinG`); conversion to imperial happens only in the UI. Schemas enforce plausible ranges
  (e.g. `weightKg` 0–700, non-negative macros).
- **Bounded documents:** embedded arrays have maximum lengths; free text has maximum lengths.
- **Deletion:** deleting a user deletes all their documents (account deletion and privacy).

### Collections

| Collection | Fields (beyond `_id`, timestamps) | Indexes | Notes |
|---|---|---|---|
| `users` | `email`, `name`, `passwordHash` (auth sprint), `profile { heightCm, dateOfBirth (IsoDate), goal, preferredUnits }` | unique `email` (stored lower-case, trimmed) | Profile embedded: one-to-one, always read with the user. `passwordHash` excluded from queries by default (`select: false`). |
| `workouts` | `userId`, `name`, `date` (Date), `exercises[]` | `{ userId: 1, date: -1 }` | Exercises are embedded subdocuments (`name`, `muscleGroup`, `sets[{ repetitions, weightKg \| null, completed }]`); their `_id` is the frontend `Exercise.id`. Workouts are read and written as a unit; limit e.g. 50 exercises × 50 sets. |
| `exercises` | — | — | **Not a separate collection for now**: in the frontend model an exercise belongs to one workout. A shared exercise catalogue (names, muscle groups, instructions) can become its own collection later and be referenced by id. |
| `nutritionEntries` | `userId`, `date` (IsoDate), `foodName`, `serving { amount, unit }`, `caloriesKcal`, `proteinG`, `carbohydratesG`, `fatG`, `loggedAt?` (Date) | `{ userId: 1, date: -1 }` | One document per logged food (unbounded per day, so not embedded). `date` is a proposed addition to the frontend model: `loggedAt` is optional, and daily totals need a local-day key. |
| `bodyMeasurements` | `userId`, `date` (IsoDate), `weightKg`, `circumferencesCm?`, `bodyFatPercent?` | unique `{ userId: 1, date: -1 }` | One entry per user per day (to confirm with the Progress feature); progress charts read by date range. |
| `coachMessages` | `userId`, `role` (`user` \| `assistant`), `content` | `{ userId: 1, createdAt: -1 }` | `timestamp` in the frontend model maps to `createdAt`. Content length capped. Retention period and a possible `conversationId` to be decided with the AI Coach feature; messages may contain health information, so they are never logged. |

Schemas will use Mongoose validation as the last line of defence; request validation in routes stays the
first one. Indexes are created deliberately in production (e.g. `Model.syncIndexes()` in a release step)
because `autoIndex` is disabled there.

## 9. Progressive Web App

Configuration: `pwa.config.ts` (used by `vite.config.ts` through `vite-plugin-pwa`; rules tested in
`pwa.config.test.ts`; generated output checked by `npm run verify:pwa`). Test results, installation steps and
platform limitations: `docs/fit-9-pwa-qa-report.md`.

### Caching rules

| Request | Handling |
|---|---|
| Build output (`index.html`, hashed JS/CSS/fonts, icons, manifest) | Precached at install, versioned by Workbox; replaced as a set when a new version activates |
| Navigations (any app route) | Precached `index.html` (app shell), online and offline |
| `/api`, `/api/…`, `/api?…` (fetches and navigations) | Network only; never cached |
| Anything else | Network (no runtime caching) |

Do not add `runtimeCaching` for API or user data. Offline data would need its own design
(e.g. IndexedDB with explicit sync and per-user clean-up on sign-out), decided with the feature that needs it.

### Code

| File | Layer | Responsibility |
|---|---|---|
| `src/app/pwa/ServiceWorkerUpdates.tsx` | app | Registers the service worker (`virtual:pwa-register`; a no-op in dev and tests), checks for updates hourly and when the app becomes visible, shows the update notice |
| `src/app/pwa/PwaStatus.tsx` | app | Fixed, bottom-centred status region above the bottom navigation and safe area; rendered once in `App.tsx` |
| `src/components/feedback/UpdateAvailableNotice.tsx` | components | "A new version is available": *Reload to update* / dismiss |
| `src/components/feedback/OfflineIndicator.tsx` | components | Offline notice in a persistent `role="status"` region |
| `src/hooks/useOnlineStatus.ts` | hooks | `navigator.onLine` + `online`/`offline` events via `useSyncExternalStore` |

### Update lifecycle

1. A new deploy changes `sw.js`. The browser finds it on page load, on the hourly check, or when the app returns to the foreground.
2. The new worker precaches the new files and **waits** (`skipWaiting: false`, `clientsClaim: false`).
3. The app shows the update notice. The current page keeps running the old version, so lazily loaded files from
   one version are never mixed with another.
4. *Reload to update* sends `SKIP_WAITING`. The new worker activates, the page reloads on `controllerchange`, and old caches are removed.
   If the user dismisses the notice instead, the update applies the next time all app windows are closed and reopened.

## 10. Authentication and sessions

Details, threat model and test results: `docs/fit-11-auth-qa-report.md`.

### Request path

```
Browser ── same origin ──► Cloudflare Worker (static assets; /api/* → worker/index.ts)
                                │ adds X-Fitness-Proxy-Auth (PROXY_SECRET) + X-Fitness-Client-Ip
                                ▼
                           Render API: proxyGate → rate limit → CSRF → JSON → routes → requireAuth
```

Development uses the Vite proxy instead of the Worker (no `PROXY_SECRET`, cookie without `Secure`).

### Backend modules

| Path | Responsibility |
|---|---|
| `src/auth/password.ts` | Argon2id hashing (OWASP parameters), dummy verification for unknown emails |
| `src/auth/session-token.ts` | 256-bit tokens; SHA-256 digests are what is stored |
| `src/auth/cookies.ts` | `__Host-fa_session` (production) / `fa_session` (local), HttpOnly, SameSite=Strict, 14 days |
| `src/auth/validation.ts` | Body shape (unknown keys rejected), email/name/password rules, NFKC, lone-surrogate rejection |
| `src/models/user.ts`, `session.ts` | Mongoose models; unique email, unique token hash, TTL on `expiresAt` |
| `src/services/auth-service.ts` | register / login / logout / session lookup / profile update |
| `src/middleware/proxy-gate.ts` | Only the Worker (shared secret) may call the API; decides the client IP |
| `src/middleware/csrf.ts` | Origin allowlist for unsafe methods; JSON-only bodies |
| `src/middleware/auth.ts` | `requireAuth` (401 without a valid session), `requireDatabase` (503 while disconnected) |
| `src/routes/auth.ts` | `/api/auth/*`, `/api/users/me` |

Rule for every future endpoint with user data: mount it behind `requireAuth`, take the user id only from
`authenticated(res).userId`, and include it in every query filter. Never accept a user id from the request.

### Frontend modules

| Path | Layer | Responsibility |
|---|---|---|
| `services/api/auth.ts` | services | Endpoint calls (70 s timeout for cold starts), response validation, error → form copy |
| `hooks/useAuth.ts` | hooks | `AuthContext` and `useAuth()` |
| `app/providers/AuthProvider.tsx` | app | Session state from `GET /api/auth/me`; `unavailable` (offline/cold start) with automatic retry |
| `app/auth/AuthGate.tsx` | app | `RequireAuth` (protected layout route) and `GuestOnly` (login/register) |
| `features/auth/*` | features | Login and registration forms |
| `utils/safe-redirect.ts` | utils | `?redirect=` validation (same-app paths only) |

The frontend guard is UX only; authorization is enforced by the API on every request.
