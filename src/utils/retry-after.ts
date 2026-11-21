/**
 * Parses an HTTP Retry-After header value into whole seconds from `now`.
 * Accepts delta-seconds ("120") and HTTP dates ("Wed, 21 Oct 2026 07:28:00 GMT").
 * Returns undefined for missing or invalid values; past dates become 0.
 */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  const text = value?.trim()
  if (!text) return undefined
  if (/^\d+$/.test(text)) {
    const seconds = Number(text)
    return Number.isSafeInteger(seconds) ? seconds : undefined
  }
  // Only accept something that looks like an HTTP date, not arbitrary strings Date.parse tolerates.
  if (!/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)) return undefined
  const at = Date.parse(text)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, Math.ceil((at - now) / 1000))
}
