import { ok } from '@shared/result';
import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type {
  ConsentEntry,
  ConsentRepositoryPort,
} from '@application/consent/ports/consent-repository.port';
import type { AppDb } from '@infrastructure/db/client';
import { withTenantContext } from '@infrastructure/db/tenant-context';
import { consentRecords } from '@infrastructure/db/schema';

/**
 * Drizzle implementation of `ConsentRepositoryPort`.
 *
 * @remarks
 * Consent records are append-only by design (RA 10173 audit trail).
 * There are no update or delete operations on this adapter — write them
 * and never touch them again.
 * RLS on `consent_records` scopes all queries to the current tenant context.
 */
export class DrizzleConsentRepository implements ConsentRepositoryPort {
  /**
   * @param db - Injected Drizzle client; never the global singleton.
   */
  constructor(private readonly db: AppDb) {}

  /**
   * Appends a consent record to the database (append-only).
   *
   * @param entry - The consent event to persist.
   * @returns `ok(void)` on success, or a domain error on write failure.
   */
  async record(entry: ConsentEntry): Promise<Result<void, DomainError>> {
    return withTenantContext(this.db, entry.tenantId, async (tx) => {
      await tx.insert(consentRecords).values({
        id: entry.id,
        tenantId: entry.tenantId.value,
        participantId: entry.participantId,
        consentText: entry.consentText,
        privacyPolicyVersion: entry.privacyPolicyVersion,
        method: entry.method,
        givenAt: entry.givenAt,
      });
      return ok(undefined);
    });
  }
}
