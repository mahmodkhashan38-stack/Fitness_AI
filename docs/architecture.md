# Fitness AI — Frontend Architecture

Status: FIT-4 (Sprint 1). Describes how the code is organised and where state lives.
The API layer (FIT-5) and global error/loading handling (FIT-6) are not covered yet.

## 1. Folder structure and layers

```
src/
├── app/          App entry: providers, router, route layouts wiring
├── pages/        Thin route entry points (one per route)
├── features/     Feature modules (code used by one feature only)
├── components/   Shared UI: design system (ui/) and app shell (layout/)
├── hooks/        Shared hooks and shared-state contexts (e.g. useTheme)
├── services/     Shared data access (populated in FIT-5)
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
| **Server state** (workouts, meals, messages — FIT-5+) | Feature hooks calling feature services, close to where data is used | Not global context |

Rules:

1. Start local. Lift state up only as far as the nearest common parent.
2. Add a context only when unrelated parts of the tree need the same state.
   One concern per context; never one giant app context.
3. Memoise context values (`useMemo`) and keep setters stable (`useCallback`), so only
   consumers re-render. Split a context into state and actions if updates become frequent.
4. Mount a provider at the narrowest scope that needs it: app-wide providers go in
   `app/providers/AppProviders.tsx`; feature-wide providers are mounted by that feature's route/layout.
5. Do not put API responses in global context. Server data is cached, refetched and
   invalidated differently; FIT-5 will decide the data-fetching approach. Adopting
   TanStack Query is reasonable once caching/deduplication is actually required.
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

## 3. Domain models

`src/types/models/` holds preliminary frontend contracts (not final backend schemas):
`User`, `Workout` / `Exercise` / `ExerciseSet`, `NutritionEntry`, `BodyMeasurement`, `CoachMessage`.

- Units are canonical metric and explicit in field names: `weightKg`, `heightCm`,
  `caloriesKcal`, `proteinG`. Convert for display only.
- Dates: `IsoDate` (`YYYY-MM-DD`) for calendar days, `IsoDateTime` for instants.
- Import models from their file, e.g. `import type { Workout } from '@/types/models/workout'`.

## 4. Testing

`npm test` runs Vitest (jsdom + React Testing Library). Tests sit next to the code they cover
(`*.test.ts(x)`); cross-cutting examples live in `src/test/`. Test-only components never ship.
