import type { CookieOptions, Request, Response } from 'express'

/** Session lifetime. Absolute: a session ends 14 days after login, whatever the activity. */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000

/**
 * `__Host-` (production) makes browsers enforce Secure, Path=/ and no Domain attribute,
 * so the cookie can only be set by, and sent to, this exact host over HTTPS.
 * Local development over http://localhost uses a plain name without Secure.
 */
export function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-fa_session' : 'fa_session'
}

function cookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true, // not readable by JavaScript (XSS can't steal it)
    secure,
    sameSite: 'strict', // never sent on cross-site requests (CSRF), see also middleware/csrf.ts
    path: '/',
  }
}

export function setSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(sessionCookieName(secure), token, { ...cookieOptions(secure), maxAge: SESSION_TTL_MS })
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(sessionCookieName(secure), cookieOptions(secure))
}

/** Parses the Cookie header (RFC 6265 "name=value; name2=value2"); malformed pairs are ignored. */
export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>()
  if (!header) return cookies
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=')
    if (index <= 0) continue
    const name = pair.slice(0, index).trim()
    let value = pair.slice(index + 1).trim()
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1)
    try {
      value = decodeURIComponent(value)
    } catch {
      continue
    }
    if (name && !cookies.has(name)) cookies.set(name, value)
  }
  return cookies
}

export function readSessionCookie(req: Request, secure: boolean): string | undefined {
  return parseCookies(req.get('cookie')).get(sessionCookieName(secure))
}
