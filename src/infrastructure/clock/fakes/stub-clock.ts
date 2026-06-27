import type { ClockPort } from '@application/clock/ports/clock.port';

/**
 * Deterministic clock for unit tests.
 *
 * @remarks
 * Inject `StubClock` in place of a `SystemClock` to control time in tests.
 * Construct with a specific `Date` to freeze time, or call `set()` to advance it.
 */
export class StubClock implements ClockPort {
  private _now: Date;

  /**
   * @param initial - The starting time; defaults to the current wall-clock time at construction.
   */
  constructor(initial: Date = new Date()) {
    this._now = initial;
  }

  /**
   * Returns the currently configured time.
   *
   * @returns The frozen or last-set `Date` value.
   */
  now(): Date {
    return this._now;
  }

  /**
   * Advances (or sets) the clock to the given date.
   *
   * @param date - The new "current" time.
   */
  set(date: Date): void {
    this._now = date;
  }
}
