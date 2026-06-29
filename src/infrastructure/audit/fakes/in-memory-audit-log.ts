import { ok } from '@shared/result';
import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type { AuditEntry, AuditLogPort } from '@application/audit/ports/audit-log.port';

/**
 * In-memory implementation of `AuditLogPort` for unit tests.
 *
 * @remarks
 * Entries are append-only (SECURITY.md §7). `entries` is a read-only view
 * exposed for test assertions — use it to verify that use cases emit the
 * expected audit events unconditionally.
 */
export class InMemoryAuditLog implements AuditLogPort {
  private readonly _entries: AuditEntry[] = [];

  /**
   * Appends an audit entry to the in-memory log.
   *
   * @param entry - The audit event to record.
   * @returns `ok(void)` always in this in-memory implementation.
   */
  async append(entry: AuditEntry): Promise<Result<void, DomainError>> {
    this._entries.push(entry);
    return ok(undefined);
  }

  /** Read-only view of recorded audit entries. Use in test assertions. */
  get entries(): readonly AuditEntry[] {
    return this._entries;
  }

  /** Total number of recorded audit entries. */
  get size(): number {
    return this._entries.length;
  }

  /** Clears all entries. Call in `beforeEach` to reset state between tests. */
  clear(): void {
    this._entries.length = 0;
  }
}
