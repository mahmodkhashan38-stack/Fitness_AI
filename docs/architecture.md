# Fitness AI — Frontend Architecture

Status: FIT-6 (Sprint 1). Describes how the code is organised, where state lives, how the app
talks to the API, and how errors and loading states are handled.

> **There is no backend yet.** The API client is infrastructure only; no feature calls it so far.

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
- No retries, request deduplication or caching. For user-facing errors see section 4.
- `fetch` default credentials (`same-origin`); cookie vs. token auth is undecided.
- No backend exists; nothing in the app calls the client yet.

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
