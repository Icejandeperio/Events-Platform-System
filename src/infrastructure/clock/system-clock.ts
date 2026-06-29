import type { ClockPort } from '@application/clock/ports/clock.port';

/**
 * Production implementation of `ClockPort` — delegates to `new Date()`.
 *
 * @remarks
 * Use `StubClock` in tests for deterministic time control.
 */
export class SystemClock implements ClockPort {
  /**
   * Returns the current wall-clock time.
   *
   * @returns The current `Date`.
   */
  now(): Date {
    return new Date();
  }
}
