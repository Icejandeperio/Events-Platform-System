import type { IdPort } from '@application/id/ports/id.port';

/**
 * Predictable sequential ID generator for unit tests.
 *
 * @remarks
 * Returns IDs like `"id-0001"`, `"id-0002"`, … so test assertions can use
 * hard-coded expected IDs without relying on UUID randomness.
 * In production, `CryptoIdAdapter` calls `crypto.randomUUID()` instead.
 * Call `reset()` in `beforeEach` to restart the counter.
 */
export class SequentialIdFake implements IdPort {
  private counter = 0;
  private readonly prefix: string;

  /**
   * @param prefix - Prefix prepended to each ID (default: `"id"`).
   */
  constructor(prefix = 'id') {
    this.prefix = prefix;
  }

  /**
   * Returns the next sequential ID string, e.g. `"id-0001"`.
   *
   * @returns A zero-padded sequential identifier.
   */
  generate(): string {
    this.counter += 1;
    return `${this.prefix}-${String(this.counter).padStart(4, '0')}`;
  }

  /** Resets the counter to zero. Call in `beforeEach` to ensure test isolation. */
  reset(): void {
    this.counter = 0;
  }
}
