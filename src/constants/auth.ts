/** Show the cold-start hint ("Waking up Fitness AI…") after a session check takes this long. */
export const SLOW_THRESHOLD_MS = 4_000

/** Delays between automatic session checks while the server is unreachable (last value repeats). */
export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const
