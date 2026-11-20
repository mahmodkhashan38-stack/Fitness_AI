export type NodeEnvironment = 'development' | 'test' | 'production'

export interface AppConfig {
  port: number
  nodeEnv: NodeEnvironment
  isProduction: boolean
  /** Never log this value. */
  mongodbUri: string
  /** Exact browser origins allowed by CORS. */
  corsOrigins: readonly string[]
  /**
   * Number of reverse proxies in front of the app whose X-Forwarded-For entries are trusted
   * (Express "trust proxy" hop count). 0 = trust none (direct exposure, local development).
   * Render: 1. A wrong value either lets clients spoof their IP or makes all users share one
   * rate-limit bucket, so production requires it explicitly.
   */
  trustProxyHops: number
}

/** Thrown when the environment is invalid. Lists every problem; never includes secret values. */
export class ConfigError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`)
    this.name = 'ConfigError'
    this.problems = problems
  }
}

const NODE_ENVS: readonly NodeEnvironment[] = ['development', 'test', 'production']
const DEFAULT_PORT = 3000
const DEFAULT_DEV_CORS_ORIGIN = 'http://localhost:5173'
const MAX_TRUST_PROXY_HOPS = 5

/** Query options that would disable or weaken TLS to MongoDB. */
const INSECURE_TLS_OPTION = /[?&](?:tls|ssl)=false\b|[?&]tls(?:Insecure|AllowInvalidCertificates|AllowInvalidHostnames)=true\b/i
/** mongodb+srv:// enables TLS by default; plain mongodb:// needs tls=true (or ssl=true). */
const usesTls = (uri: string) => uri.startsWith('mongodb+srv://') || /[?&](?:tls|ssl)=true\b/i.test(uri)

const read = (env: NodeJS.ProcessEnv, key: string): string | undefined => {
  const value = env[key]?.trim()
  return value === '' ? undefined : value
}

/**
 * Reads and validates configuration from environment variables.
 * Throws ConfigError with all problems at once.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = []

  // NODE_ENV
  const rawNodeEnv = read(env, 'NODE_ENV') ?? 'development'
  const nodeEnv = (NODE_ENVS as readonly string[]).includes(rawNodeEnv) ? (rawNodeEnv as NodeEnvironment) : undefined
  if (!nodeEnv) problems.push(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}.`)
  const isProduction = nodeEnv === 'production'

  // PORT
  const rawPort = read(env, 'PORT')
  let port = DEFAULT_PORT
  if (rawPort !== undefined) {
    const parsed = Number(rawPort)
    if (!/^\d+$/.test(rawPort) || !Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
      problems.push('PORT must be an integer between 1 and 65535.')
    } else {
      port = parsed
    }
  }

  // MONGODB_URI (value is never echoed)
  const mongodbUri = read(env, 'MONGODB_URI') ?? ''
  if (!mongodbUri) {
    problems.push('MONGODB_URI is required (a mongodb:// or mongodb+srv:// connection string).')
  } else if (!/^mongodb(\+srv)?:\/\/\S+$/.test(mongodbUri)) {
    problems.push('MONGODB_URI must start with mongodb:// or mongodb+srv://.')
  } else if (INSECURE_TLS_OPTION.test(mongodbUri)) {
    problems.push('MONGODB_URI must not disable or weaken TLS (tls=false, ssl=false, tlsInsecure, tlsAllowInvalid…).')
  } else if (isProduction && !usesTls(mongodbUri)) {
    problems.push('MONGODB_URI must use TLS in production (mongodb+srv:// or tls=true).')
  }

  // TRUST_PROXY_HOPS
  const rawHops = read(env, 'TRUST_PROXY_HOPS')
  let trustProxyHops = 0
  if (rawHops === undefined) {
    if (isProduction) problems.push('TRUST_PROXY_HOPS is required in production (number of reverse proxies in front of the app; Render: 1).')
  } else if (!/^\d+$/.test(rawHops) || Number(rawHops) > MAX_TRUST_PROXY_HOPS) {
    problems.push(`TRUST_PROXY_HOPS must be an integer between 0 and ${MAX_TRUST_PROXY_HOPS}.`)
  } else {
    trustProxyHops = Number(rawHops)
  }

  // CORS_ORIGIN
  const rawCors = read(env, 'CORS_ORIGIN')
  let corsOrigins: string[] = []
  if (rawCors === undefined) {
    if (isProduction) problems.push('CORS_ORIGIN is required in production (comma-separated https origins).')
    else corsOrigins = [DEFAULT_DEV_CORS_ORIGIN]
  } else {
    for (const entry of rawCors.split(',').map((value) => value.trim()).filter(Boolean)) {
      if (entry === '*') {
        problems.push('CORS_ORIGIN must list explicit origins; "*" is not allowed.')
        continue
      }
      let url: URL
      try {
        url = new URL(entry)
      } catch {
        problems.push(`CORS_ORIGIN entry "${entry}" is not a valid origin (expected e.g. https://app.example.com).`)
        continue
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        problems.push(`CORS_ORIGIN entry "${entry}" must use http or https.`)
      } else if (url.origin !== entry.replace(/\/$/, '')) {
        problems.push(`CORS_ORIGIN entry "${entry}" must be an origin only (scheme://host[:port], no path, query or credentials).`)
      } else if (isProduction && url.protocol !== 'https:') {
        problems.push(`CORS_ORIGIN entry "${entry}" must use https in production.`)
      } else {
        corsOrigins.push(url.origin)
      }
    }
    if (corsOrigins.length === 0 && !problems.some((problem) => problem.startsWith('CORS_ORIGIN'))) {
      problems.push('CORS_ORIGIN must contain at least one origin.')
    }
    corsOrigins = [...new Set(corsOrigins)]
  }

  if (problems.length > 0) throw new ConfigError(problems)

  return { port, nodeEnv: nodeEnv ?? 'development', isProduction, mongodbUri, corsOrigins, trustProxyHops }
}
