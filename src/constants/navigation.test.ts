import { describe, expect, it } from 'vitest'
import {
  MOBILE_NAV,
  MOBILE_NAV_CENTER,
  NAV_ITEMS,
  SIDEBAR_PRIMARY_NAV,
  SIDEBAR_SECONDARY_NAV,
} from '@/constants/navigation'
import { ROUTES } from '@/constants/routes'

describe('navigation config', () => {
  it('keeps Dashboard in the exact centre of the mobile navigation', () => {
    expect(MOBILE_NAV).toEqual(['progress', 'workouts', 'dashboard', 'nutrition', 'aiCoach'])
    expect(MOBILE_NAV[Math.floor(MOBILE_NAV.length / 2)]).toBe(MOBILE_NAV_CENTER)
    expect(MOBILE_NAV.length % 2).toBe(1)
  })

  it('lists every primary destination exactly once in both navigations', () => {
    expect([...MOBILE_NAV].sort()).toEqual([...SIDEBAR_PRIMARY_NAV].sort())
    expect(new Set(SIDEBAR_PRIMARY_NAV).size).toBe(SIDEBAR_PRIMARY_NAV.length)
    expect(SIDEBAR_SECONDARY_NAV).toEqual(['profile', 'settings'])
  })

  it('points every item at a known route and matches its id', () => {
    const routes = new Set<string>(Object.values(ROUTES))
    for (const [id, item] of Object.entries(NAV_ITEMS)) {
      expect(item.id).toBe(id)
      expect(routes.has(item.path)).toBe(true)
      expect(item.description.length).toBeGreaterThan(0)
    }
  })
})
