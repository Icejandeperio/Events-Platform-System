/**
 * Driven port — wall-clock access.
 *
 * @remarks
 * Inject this port into use-cases instead of calling `new Date()` directly so
 * tests can control time deterministically via `StubClock`.
 * Production wiring: `SystemClock` simply returns `new Date()`.
 */
export interface ClockPort {
  /**
   * Returns the current point in time.
   *
   * @returns The current `Date` as reported by the underlying clock implementation.
   */
  now(): Date;
}
