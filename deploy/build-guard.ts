/**
 * Build-time guard for Cloudflare Workers Builds.
 *
 * The production app must call the API through its own origin (`/api`), which the Worker in
 * worker/ forwards to Render. Pointing the bundle straight at Render would make the session
 * cookie third-party (blocked by Safari) and bypass the proxy's shared-secret gate, so login
 * would break in production. `.env.production` sets `/api`, but a build variable in the
 * Cloudflare dashboard overrides it; this guard fails such a build instead of deploying it.
 */

/** Value the deployed bundle must use. */
export const WORKER_API_BASE_URL = '/api'

/** Cloudflare Workers Builds injects WORKERS_CI=1 into every build. */
export function isWorkersBuild(env: Record<string, string | undefined>): boolean {
  return env.WORKERS_CI === '1'
}

/**
 * Throws when a Workers Builds production build would embed an API base URL other than `/api`.
 * Local builds (and other hosts) are not restricted.
 */
export function assertWorkersBuildApiBase(options: {
  mode: string
  env: Record<string, string | undefined>
  apiBaseUrl: string | undefined
}): void {
  const { mode, env, apiBaseUrl } = options
  if (!isWorkersBuild(env) || mode !== 'production') return
  if (apiBaseUrl?.trim() === WORKER_API_BASE_URL) return
  throw new Error(
    `Cloudflare Workers Build: VITE_API_BASE_URL must be "${WORKER_API_BASE_URL}" (got ${JSON.stringify(apiBaseUrl ?? null)}). ` +
      'Remove or correct the VITE_API_BASE_URL build variable in the Cloudflare dashboard; .env.production already sets /api.',
  )
}
