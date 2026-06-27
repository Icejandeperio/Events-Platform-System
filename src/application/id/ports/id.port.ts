/**
 * Driven port — unique identifier generation.
 *
 * @remarks
 * Inject this port into use-cases instead of calling `crypto.randomUUID()` directly
 * so tests can produce predictable, assertion-friendly IDs via `SequentialIdFake`.
 * Production wiring: `CryptoIdAdapter` calls `crypto.randomUUID()` and returns
 * a UUIDv4 string (golden rule 4 — all public IDs are UUIDv4).
 */
export interface IdPort {
  /**
   * Generates a new unique identifier string.
   *
   * @returns A UUIDv4 string in production; a predictable string in test fakes.
   */
  generate(): string;
}
