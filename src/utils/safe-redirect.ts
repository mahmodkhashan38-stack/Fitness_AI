/**
 * Pages that make no sense as a post-login destination. /onboarding is reached through its
 * own gate; as a redirect target it could bounce between the onboarding gates.
 */
const EXCLUDED = ['/login', '/register', '/onboarding']

/**
 * Validates a ?redirect= value so login can only send users to a page of this app:
 * a single-slash absolute path, never another origin (open redirect) or a script URL.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\\]/.test(value)) return null
  let url: URL
  try {
    url = new URL(value, 'https://app.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'https://app.invalid') return null
  if (EXCLUDED.includes(url.pathname)) return null
  return `${url.pathname}${url.search}${url.hash}`
}
