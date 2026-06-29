import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * An audit log entry recording a sensitive or security-relevant action.
 *
 * @remarks
 * Covers: auth events, PII access, payment-status changes, file access,
 * role/entitlement changes (SECURITY.md §7). `metadata` must carry only
 * resource IDs — never raw PII or secrets.
 */
export interface AuditEntry {
  readonly tenantId: TenantId;
  /** User who performed the action; `null` for system/webhook-triggered events. */
  readonly actorId: string | null;
  /** Namespaced action slug, e.g. `"payment.confirmed"`, `"participant.pii_accessed"`. */
  readonly action: string;
  /** Resource type acted upon, e.g. `"payment"`, `"participant"`. */
  readonly resourceType: string;
  /** UUIDv4 of the affected resource. */
  readonly resourceId: string;
  /** Structured detail — IDs only, no secrets, no raw PII. */
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt: Date;
}

/**
 * Write-only port for the append-only audit log.
 *
 * @remarks
 * This port is called directly within use cases — never deferred or skipped.
 * The underlying adapter must never delete or update rows (SECURITY.md §7).
 */
export interface AuditLogPort {
  /**
   * Appends an audit entry to the log.
   *
   * @param entry - The audit event to record.
   * @returns `ok(void)` on success, or a domain error if the write fails.
   */
  append(entry: AuditEntry): Promise<Result<void, DomainError>>;
}
