import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'coverage']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
    rules: {
      // All logging goes through src/utils/logger.ts, which redacts secrets.
      'no-console': 'error',
    },
  },
  {
    files: ['src/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  },
])
