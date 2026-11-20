import { apiClient } from '@/services/api/client'
import { ApiError, isApiError } from '@/services/api/errors'
import type { ApiClient } from '@/services/api/types'

/** Mirrors `HealthResponse` in backend/src/routes/health.ts. */
export type DatabaseStatus = 'connected' | 'connecting' | 'disconnecting' | 'disconnected'

export interface ApiHealth {
  status: 'ok' | 'degraded'
  database: DatabaseStatus
  timestamp: string
  uptimeSeconds: number
}

const STATUSES: readonly ApiHealth['status'][] = ['ok', 'degraded']
const DATABASE_STATUSES: readonly DatabaseStatus[] = ['connected', 'connecting', 'disconnecting', 'disconnected']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Validates a GET /api/health body; throws if it doesn't match the contract. */
export function parseApiHealth(data: unknown): ApiHealth {
  if (
    !isRecord(data) ||
    !STATUSES.includes(data.status as ApiHealth['status']) ||
    !DATABASE_STATUSES.includes(data.database as DatabaseStatus) ||
    typeof data.timestamp !== 'string' ||
    Number.isNaN(Date.parse(data.timestamp)) ||
    typeof data.uptimeSeconds !== 'number' ||
    !Number.isFinite(data.uptimeSeconds)
  ) {
    throw new TypeError('Unexpected health response')
  }
  return {
    status: data.status as ApiHealth['status'],
    database: data.database as DatabaseStatus,
    timestamp: data.timestamp,
    uptimeSeconds: data.uptimeSeconds,
  }
}

/**
 * Checks that the backend is reachable. Resolves for both "ok" (200) and "degraded"
 * (503: API up, database unavailable). Throws ApiError for anything else
 * (network, timeout, config, other HTTP statuses, malformed responses).
 */
export async function fetchApiHealth(
  options: { signal?: AbortSignal; client?: ApiClient } = {},
): Promise<ApiHealth> {
  const client = options.client ?? apiClient
  try {
    return await client.get('/health', { signal: options.signal, parse: parseApiHealth, timeoutMs: 5_000 })
  } catch (error) {
    if (isApiError(error) && error.kind === 'http' && error.status === 503) {
      try {
        return parseApiHealth(error.body)
      } catch (cause) {
        throw new ApiError({
          kind: 'parse',
          method: 'GET',
          path: '/health',
          status: 503,
          message: 'GET /health: unexpected 503 response body',
          cause,
        })
      }
    }
    throw error
  }
}
