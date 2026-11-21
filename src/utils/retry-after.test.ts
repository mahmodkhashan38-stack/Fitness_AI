import { describe, expect, it } from 'vitest'
import { parseRetryAfter } from '@/utils/retry-after'

const NOW = Date.parse('2026-11-21T09:43:00Z')

describe('parseRetryAfter', () => {
  it.each([
    ['0', 0],
    ['30', 30],
    [' 120 ', 120],
    ['Sat, 21 Nov 2026 09:45:00 GMT', 120],
    ['Sat, 21 Nov 2026 09:42:00 GMT', 0],
  ])('%j → %s seconds', (value, seconds) => {
    expect(parseRetryAfter(value, NOW)).toBe(seconds)
  })

  it.each([null, undefined, '', 'soon', '-5', '1.5', '2026-11-21T09:45:00Z', '99999999999999999999'])('ignores %j', (value) => {
    expect(parseRetryAfter(value, NOW)).toBeUndefined()
  })
})
