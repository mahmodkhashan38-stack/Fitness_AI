import type { EntityId, IsoDateTime } from '@/types/models/common'

export type ServingUnit = 'g' | 'ml' | 'piece' | 'serving'

export interface ServingQuantity {
  amount: number
  unit: ServingUnit
}

/** One logged food. Energy in kcal, macronutrients in grams, for the logged serving. */
export interface NutritionEntry {
  id: EntityId
  foodName: string
  serving: ServingQuantity
  caloriesKcal: number
  proteinG: number
  carbohydratesG: number
  fatG: number
  /** When the food was eaten, if known. */
  loggedAt?: IsoDateTime
}
