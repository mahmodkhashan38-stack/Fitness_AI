import type { EntityId, IsoDateTime } from '@/types/models/common'

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'full-body'
  | 'cardio'

export interface ExerciseSet {
  repetitions: number
  /** External load in kilograms. `null` for bodyweight sets. */
  weightKg: number | null
  completed: boolean
}

export interface Exercise {
  id: EntityId
  name: string
  muscleGroup: MuscleGroup
  sets: ExerciseSet[]
}

export interface Workout {
  id: EntityId
  name: string
  /** When the workout was performed or is scheduled. */
  date: IsoDateTime
  exercises: Exercise[]
}
