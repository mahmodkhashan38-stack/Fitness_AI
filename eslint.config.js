import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/*
 * Import boundaries (see docs/architecture.md).
 * Layers may only import from layers below them:
 *
 *   app → pages → features → components → hooks → services → utils / constants / types
 *
 * `dev/` (development-only tools) may use anything except `app/`.
 * Features must not import from other features; share code through the lower layers.
 * Imports between folders use the `@/` alias, not `../`.
 */
const FEATURES = ['auth', 'dashboard', 'workouts', 'nutrition', 'progress', 'ai-coach', 'account']

const layerGlob = (layer) => [`@/${layer}`, `@/${layer}/**`]

const RELATIVE_PARENT = {
  group: ['../*', '../**'],
  message: 'Use the "@/" alias for imports outside the current folder.',
}

const restrict = (bannedLayers, extraGroups = []) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        RELATIVE_PARENT,
        ...(bannedLayers.length
          ? [
              {
                group: bannedLayers.flatMap(layerGlob),
                message: `This layer must not import from: ${bannedLayers.join(', ')}. See docs/architecture.md.`,
              },
            ]
          : []),
        ...extraGroups,
      ],
    },
  ],
})

const FOUNDATION = 'src/{types,constants,utils}/**/*.{ts,tsx}'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },

  // --- Import boundaries (each file matches exactly one block) ---
  { files: ['src/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}'], rules: restrict([]) },
  { files: ['src/pages/**/*.{ts,tsx}'], rules: restrict(['app', 'dev']) },
  { files: ['src/dev/**/*.{ts,tsx}'], rules: restrict(['app']) },
  ...FEATURES.map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: restrict(
      ['app', 'pages', 'dev'],
      [
        {
          group: ['@/features/*', '@/features/*/**', `!@/features/${feature}`, `!@/features/${feature}/**`],
          message: 'Features must not import from other features. Move shared code to components/, hooks/, utils/ or types/.',
        },
      ],
    ),
  })),
  { files: ['src/components/**/*.{ts,tsx}'], rules: restrict(['app', 'pages', 'dev', 'features']) },
  { files: ['src/hooks/**/*.{ts,tsx}'], rules: restrict(['app', 'pages', 'dev', 'features', 'components']) },
  { files: ['src/services/**/*.{ts,tsx}'], rules: restrict(['app', 'pages', 'dev', 'features', 'components', 'hooks']) },
  { files: [FOUNDATION], rules: restrict(['app', 'pages', 'dev', 'features', 'components', 'hooks', 'services']) },

  // Tests may use any test helpers; boundaries above still apply to their imports of app code.
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
