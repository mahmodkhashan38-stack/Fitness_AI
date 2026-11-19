/**
 * Shared primitives for the frontend domain models.
 * These are preliminary client contracts, not final backend schemas (the API layer arrives in FIT-5).
 *
 * Units are canonical and explicit in field names (kg, cm, kcal, g). Convert to the
 * user's preferred unit system only when displaying values.
 */

/** Opaque identifier issued by the backend. */
export type EntityId = string

/** Calendar date, ISO 8601 `YYYY-MM-DD` (no time zone), e.g. "2026-11-19". */
export type IsoDate = string

/** Instant in time, ISO 8601 with offset, e.g. "2026-11-19T07:30:00+02:00". */
export type IsoDateTime = string

/** How values are displayed to the user. Stored values are always metric. */
export type UnitSystem = 'metric' | 'imperial'
