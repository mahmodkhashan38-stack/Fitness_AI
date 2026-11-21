/** Display name rules, mirroring the API (backend/src/auth/validation.ts validateName). */
export const NAME_MAX_LENGTH = 60

// Control characters, which the API refuses (same range as the API).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

/** Error message for a display name, or undefined if it is valid. Whitespace is collapsed as the API does. */
export function validateDisplayName(name: string): string | undefined {
  const normalised = name.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (!normalised) return 'Enter your name.'
  if (normalised.length > NAME_MAX_LENGTH) return `Use at most ${NAME_MAX_LENGTH} characters.`
  if (CONTROL_CHARACTERS.test(normalised)) return 'Remove unsupported characters.'
  return undefined
}
