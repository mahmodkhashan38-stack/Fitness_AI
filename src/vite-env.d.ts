/// <reference types="vite/client" />

/**
 * Typed Vite environment variables.
 * Everything prefixed with VITE_ is embedded in the browser bundle and is public:
 * never put secrets, API keys or credentials in these variables.
 */
interface ImportMetaEnv {
  /** Base URL of the Fitness AI API, e.g. "https://api.example.com/v1" or "/api". Optional until a backend exists. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
