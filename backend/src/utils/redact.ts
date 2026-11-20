/**
 * Removes credentials from text before it is logged:
 * - user:password in URLs (mongodb://user:pass@host → mongodb://***:***@host)
 * - common secret query parameters (password=, token=, apiKey= …)
 */
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/gi
const SECRET_PARAMS = /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)=([^&\s]+)/gi

export function redactSecrets(text: string): string {
  return text.replace(URL_CREDENTIALS, '$1***:***@').replace(SECRET_PARAMS, '$1=***')
}
