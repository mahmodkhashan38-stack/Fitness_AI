import type { FitnessGoal } from '@/types/fitness-profile'
import type { EntityId, IsoDate, UnitSystem } from '@/types/models/common'

/** Defined with the fitness profile (FIT-12); re-exported for the preliminary domain models. */
export type { FitnessGoal }

/** Optional details the user may add to their profile. */
export interface UserProfile {
  heightCm?: number
  dateOfBirth?: IsoDate
  goal?: FitnessGoal
  preferredUnits?: UnitSystem
}

export interface User {
  id: EntityId
  name: string
  email: string
  profile?: UserProfile
}
