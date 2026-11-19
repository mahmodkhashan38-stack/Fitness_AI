# Fitness AI — Frontend Architecture

Status: FIT-5 (Sprint 1). Describes how the code is organised, where state lives and how the app
talks to the API. Global error/loading handling (FIT-6) is not covered yet.

> **There is no backend yet.** The API client is infrastructure only; no feature calls it so far.

## 1. Folder structure and layers

```
src/
├── app/          App entry: providers, router, route layouts wiring
├── pages/        Thin route entry points (one per route)
├── features/     Feature modules (code used by one feature only)
├── components/   Shared UI: design system (ui/) and app shell (layout/)
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

Built on native `fetch`, with no HTTP library, no automatic retries and no global auth.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | Only when calling the API | Absolute `http(s)` URL or same-origin path (`/api`). Trailing slashes are removed. |

- **Development:** copy `.env.example` to `.env.local` (git-ignored) and set e.g. `http://localhost:3000/api`.
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
- No retries, request deduplication or caching.
- `fetch` default credentials (`same-origin`); cookie vs. token auth is undecided.
- No backend exists; nothing in the app calls the client yet.

## 4. Domain models

`src/types/models/` holds preliminary frontend contracts (not final backend schemas):
`User`, `Workout` / `Exercise` / `ExerciseSet`, `NutritionEntry`, `BodyMeasurement`, `CoachMessage`.

- Units are canonical metric and explicit in field names: `weightKg`, `heightCm`,
  `caloriesKcal`, `proteinG`. Convert for display only.
- Dates: `IsoDate` (`YYYY-MM-DD`) for calendar days, `IsoDateTime` for instants.
- Import models from their file, e.g. `import type { Workout } from '@/types/models/workout'`.

## 5. Testing

`npm test` runs Vitest (jsdom + React Testing Library). Tests sit next to the code they cover
(`*.test.ts(x)`); cross-cutting examples live in `src/test/`. Test-only components never ship.
API tests mock `fetch` (injected or stubbed); no test touches the network.
