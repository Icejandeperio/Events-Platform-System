import type { IdPort } from '@application/id/ports/id.port';

/**
 * Production implementation of `IdPort` — generates cryptographically random UUIDv4s.
 *
 * @remarks
 * Uses `crypto.randomUUID()` (available in Node.js 14.17+ and all modern browsers).
 * Use `SequentialIdFake` in tests for predictable IDs.
 */
export class CryptoIdAdapter implements IdPort {
  /**
   * Generates a new UUIDv4.
   *
   * @returns A cryptographically random UUIDv4 string.
   */
  generate(): string {
    return crypto.randomUUID();
  }
}
