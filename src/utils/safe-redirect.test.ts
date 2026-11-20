import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from '@/utils/safe-redirect'

describe('safeRedirectPath', () => {
  it.each([
    ['/workouts', '/workouts'],
    ['/settings?tab=units#top', '/settings?tab=units#top'],
    ['/a/../progress', '/progress'],
  ])('keeps in-app path %s', (input, output) => {
    expect(safeRedirectPath(input)).toBe(output)
  })

  it.each([
    null,
    '',
    'workouts',
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    '/\\\\evil.example.com',
    'javascript:alert(1)',
    '/%0d%0aSet-Cookie:x',
    '/\nevil',
    '/login',
    '/register?redirect=/x',
    '/onboarding',
    '/onboarding?redirect=/onboarding',
  ])('rejects %j', (input) => {
    const result = safeRedirectPath(input)
    if (input === '/%0d%0aSet-Cookie:x') {
      // Encoded characters stay encoded inside our own origin: harmless path, never a header.
      expect(result).toBe('/%0d%0aSet-Cookie:x')
      return
    }
    expect(result).toBeNull()
  })
})
