import type { EntityId, IsoDate, UnitSystem } from '@/types/models/common'

export type FitnessGoal = 'lose-fat' | 'build-muscle' | 'maintain' | 'improve-fitness'

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
