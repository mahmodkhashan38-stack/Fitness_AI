# Fitness AI

Responsive fitness application (desktop and mobile) — frontend foundation.

## Stack

React 19 · Vite 8 · TypeScript 6 (strict) · Tailwind CSS 4 · React Router 8 · Lucide React · ESLint 10

## Scripts

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the dev server                     |
| `npm run build`     | Type-check (`tsc -b`) and production build |
| `npm run typecheck` | Strict TypeScript check only             |
| `npm run lint`      | Run ESLint                               |
| `npm run preview`   | Preview the production build             |

## Structure

```
src/
├── app/            App.tsx, router.tsx
├── components/
│   ├── ui/         Reusable UI primitives
│   └── layout/     App shell / layouts
├── features/       auth, dashboard, workouts, nutrition, ai-coach, progress
├── pages/          Route-level pages
├── hooks/
├── services/
├── types/
├── utils/
├── constants/      Route paths, navigation order
├── styles/         Tailwind entry + theme tokens
└── main.tsx
```

Imports use the `@/` alias for `src/`.

## Notes

- TypeScript is pinned to 6.0 because `typescript-eslint` does not yet support TypeScript 7.
- Dark mode is class-based (`dark` class on `<html>`); the primary accent maps to Tailwind's lime palette (`primary-*`).
- Future mobile bottom navigation order is defined in `src/constants/navigation.ts`.
