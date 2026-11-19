# Fitness AI

Responsive fitness application (desktop and mobile) — frontend foundation.

## Stack

React 19 · Vite 8 · TypeScript 6 (strict) · Tailwind CSS 4 · React Router 8 · Lucide React · ESLint 10 · Vitest 5

## Scripts

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the dev server                     |
| `npm run build`     | Type-check (`tsc -b`) and production build |
| `npm run typecheck` | Strict TypeScript check only             |
| `npm run lint`      | Run ESLint (includes import-boundary rules) |
| `npm test`          | Run unit tests once (Vitest)             |
| `npm run test:watch`| Run tests in watch mode                  |
| `npm run preview`   | Preview the production build             |

## Structure

```
src/
├── app/            App.tsx, router.tsx, providers/ (AppProviders, ThemeProvider)
├── pages/          Thin route entry points
├── features/       Feature modules: auth, dashboard, workouts, nutrition, ai-coach, progress
├── components/
│   ├── ui/         Design system components
│   └── layout/     App shell (sidebar, bottom navigation, header) and public layout
├── hooks/          Shared hooks and shared-state contexts (useTheme, usePersistentState)
├── services/       Shared data access: typed API client (services/api)
├── types/          Shared types; domain models in types/models/
├── utils/          Pure helpers (storage, cn, createStrictContext)
├── constants/      Routes, navigation config, theme keys
├── styles/         Tailwind entry + design tokens
├── dev/            Development-only tools (/design-system)
├── test/           Test setup and cross-cutting tests
└── main.tsx
```

Architecture, layer rules, state management and the API layer: [docs/architecture.md](docs/architecture.md).

## Environment

The backend does not exist yet; the app runs fully without any environment variables.

```bash
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | API base URL, e.g. `http://localhost:3000/api` (dev) or `https://api.example.com/v1` (production). Optional until a backend exists. |

`VITE_*` variables are embedded in the browser bundle and are public. Never put secrets in them.
`.env.local` and other `.env.*` files are git-ignored; only `.env.example` is committed.

Imports use the `@/` alias for `src/`.

## Notes

- TypeScript is pinned to 6.0 because `typescript-eslint` does not yet support TypeScript 7.
- Dark mode is class-based (`dark` class on `<html>`); the primary accent maps to Tailwind's lime palette (`primary-*`).
- Future mobile bottom navigation order is defined in `src/constants/navigation.ts`.
