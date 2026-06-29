import { ok } from '@shared/result';
import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type {
  ConsentEntry,
  ConsentRepositoryPort,
} from '@application/consent/ports/consent-repository.port';

/**
 * In-memory implementation of `ConsentRepositoryPort` for unit tests.
 *
 * @remarks
 * Consent entries are append-only (RA 10173); there is no delete or update.
 * `entries` is a read-only view exposed for test assertions.
 */
export class InMemoryConsentRepository implements ConsentRepositoryPort {
  private readonly _entries: ConsentEntry[] = [];

  /**
   * Appends a consent entry to the in-memory log.
   *
   * @param entry - The consent event to record.
   * @returns `ok(void)` always in this in-memory implementation.
   */
  async record(entry: ConsentEntry): Promise<Result<void, DomainError>> {
    this._entries.push(entry);
    return ok(undefined);
  }

  /** Read-only view of recorded consent entries. Use in test assertions. */
  get entries(): readonly ConsentEntry[] {
    return this._entries;
  }

  /** Total number of recorded consent entries. */
  get size(): number {
    return this._entries.length;
  }

  /** Clears all entries. Call in `beforeEach` to reset state between tests. */
  clear(): void {
    this._entries.length = 0;
  }
}
