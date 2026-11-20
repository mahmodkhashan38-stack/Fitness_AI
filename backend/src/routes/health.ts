import { Router } from 'express'
import type { DatabaseStatus } from '../database/connection.js'

/** Response of GET /api/health. Mirrored by the frontend's ApiHealth type. */
export interface HealthResponse {
  status: 'ok' | 'degraded'
  database: DatabaseStatus
  timestamp: string
  uptimeSeconds: number
}

/**
 * Liveness + readiness in one: 200 when the database is connected, 503 otherwise
 * (so load balancers stop routing traffic). Contains no hostnames, versions or secrets.
 */
export function createHealthRouter(getDatabaseStatus: () => DatabaseStatus): Router {
  const router = Router()

  router.get('/health', (_req, res) => {
    const database = getDatabaseStatus()
    const healthy = database === 'connected'
    const body: HealthResponse = {
      status: healthy ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    }
    res.status(healthy ? 200 : 503).set('Cache-Control', 'no-store').json(body)
  })

  return router
}
