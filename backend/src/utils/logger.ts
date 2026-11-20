import { redactSecrets } from './redact.js'

type Level = 'debug' | 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface Logger {
  debug(message: string, fields?: Fields): void
  info(message: string, fields?: Fields): void
  warn(message: string, fields?: Fields): void
  error(message: string, fields?: Fields): void
}

function serialise(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactSecrets(value)
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecrets(value.message),
      ...(value.stack ? { stack: redactSecrets(value.stack) } : {}),
      ...(value.cause !== undefined && depth < 3 ? { cause: serialise(value.cause, depth + 1) } : {}),
    }
  }
  if (Array.isArray(value)) return value.map((item) => serialise(item, depth + 1))
  if (value && typeof value === 'object' && depth < 3) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialise(item, depth + 1)]))
  }
  return value
}

/**
 * Minimal structured logger: one JSON object per line on stdout/stderr.
 * Every string (including error messages and stacks) is passed through redactSecrets.
 * Never pass request bodies, headers or personal data as fields.
 */
export function createLogger(options: { level?: Level; silent?: boolean } = {}): Logger {
  const threshold = ORDER[options.level ?? 'info']

  const write = (level: Level, message: string, fields?: Fields) => {
    if (options.silent || ORDER[level] < threshold) return
    const entry = { time: new Date().toISOString(), level, message: redactSecrets(message), ...(fields ? (serialise(fields) as Fields) : {}) }
    const line = JSON.stringify(entry)
    if (level === 'error' || level === 'warn') console.error(line)
    else console.log(line)
  }

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  }
}
