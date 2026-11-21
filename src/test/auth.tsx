import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/hooks/useAuth'
import type { AuthUser } from '@/types/auth'

export const TEST_USER: AuthUser = {
  id: '665f1c2e9b1d4a0012345678',
  email: 'alex@example.com',
  name: 'Alex Carter',
  createdAt: '2026-11-20T10:00:00.000Z',
  onboardingCompleted: true,
}

/** A fixed auth context for component and route tests (no network). */
export function createAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const status = overrides.status ?? 'authenticated'
  return {
    status,
    user: status === 'authenticated' ? TEST_USER : null,
    slow: false,
    login: vi.fn(async () => TEST_USER),
    register: vi.fn(async () => TEST_USER),
    completeOnboarding: vi.fn(async () => {}),
    unavailable: null,
    logout: vi.fn(async () => {}),
    refresh: vi.fn(),
    ...overrides,
  }
}

export function TestAuthProvider({ value = createAuthValue(), children }: { value?: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
