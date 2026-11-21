import { describe, expect, it } from 'vitest'
import { validateDisplayName } from '@/utils/account'

describe('validateDisplayName (mirrors the API)', () => {
  it.each(['Alex', '  Alex   Rivera ', 'Ана Мария', 'نور', 'a'.repeat(60)])('accepts %j', (name) => {
    expect(validateDisplayName(name)).toBeUndefined()
  })

  it.each([
    ['', 'Enter your name.'],
    ['   ', 'Enter your name.'],
    ['a'.repeat(61), 'Use at most 60 characters.'],
    ['Alex\u0000', 'Remove unsupported characters.'],
    ['Al\u007fex', 'Remove unsupported characters.'],
  ])('rejects %j', (name, message) => {
    expect(validateDisplayName(name)).toBe(message)
  })

  it('counts length after collapsing whitespace, like the API', () => {
    expect(validateDisplayName(`${'a'.repeat(30)}      ${'b'.repeat(29)}`)).toBeUndefined()
  })
})
