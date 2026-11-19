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
├── services/       Shared data access (FIT-5)
├── types/          Shared types; domain models in types/models/
├── utils/          Pure helpers (storage, cn, createStrictContext)
├── constants/      Routes, navigation config, theme keys
├── styles/         Tailwind entry + design tokens
├── dev/            Development-only tools (/design-system)
├── test/           Test setup and cross-cutting tests
└── main.tsx
```

Architecture, layer rules and the state management strategy: [docs/architecture.md](docs/architecture.md).

Imports use the `@/` alias for `src/`.

## Notes

- TypeScript is pinned to 6.0 because `typescript-eslint` does not yet support TypeScript 7.
- Dark mode is class-based (`dark` class on `<html>`); the primary accent maps to Tailwind's lime palette (`primary-*`).
- Future mobile bottom navigation order is defined in `src/constants/navigation.ts`.
