import { ok } from '@shared/result';
import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type { AuditEntry, AuditLogPort } from '@application/audit/ports/audit-log.port';
import type { AppDb } from '@infrastructure/db/client';
import { withTenantContext } from '@infrastructure/db/tenant-context';
import { auditLog as auditLogTable } from '@infrastructure/db/schema';

/**
 * Drizzle implementation of `AuditLogPort`.
 *
 * @remarks
 * Audit entries are append-only (SECURITY.md §7, COMPLIANCE.md §2).
 * There are no update or delete operations on this adapter.
 * RLS on `audit_log` scopes all queries to the current tenant context.
 * `metadata` is stored as JSONB; never include raw PII or secrets
 * (IDs only — SECURITY.md §7).
 */
export class DrizzleAuditLog implements AuditLogPort {
  /**
   * @param db - Injected Drizzle client; never the global singleton.
   */
  constructor(private readonly db: AppDb) {}

  /**
   * Appends an audit entry to the `audit_log` table (append-only).
   *
   * @param entry - The audit event to record.
   * @returns `ok(void)` on success, or a domain error on write failure.
   */
  async append(entry: AuditEntry): Promise<Result<void, DomainError>> {
    return withTenantContext(this.db, entry.tenantId, async (tx) => {
      await tx.insert(auditLogTable).values({
        id: crypto.randomUUID(),
        tenantId: entry.tenantId.value,
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata ?? null,
        occurredAt: entry.occurredAt,
      });
      return ok(undefined);
    });
  }
}
