import type { EntityId, IsoDate } from '@/types/models/common'

/** Body sites for optional tape measurements. */
export type BodyMeasurementSite = 'chest' | 'waist' | 'hips' | 'neck' | 'arm' | 'thigh' | 'calf'

export interface BodyMeasurement {
  id: EntityId
  date: IsoDate
  weightKg: number
  /** Optional circumferences in centimetres. */
  circumferencesCm?: Partial<Record<BodyMeasurementSite, number>>
  bodyFatPercent?: number
}
