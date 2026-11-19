import type { EntityId, IsoDateTime } from '@/types/models/common'

export type CoachMessageRole = 'user' | 'assistant'

export interface CoachMessage {
  id: EntityId
  role: CoachMessageRole
  /** Plain text content. */
  content: string
  timestamp: IsoDateTime
}
