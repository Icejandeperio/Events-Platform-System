import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * A consent event recorded at the point a participant gives explicit consent.
 *
 * @remarks
 * Rows are immutable — never update or delete (RA 10173 audit trail).
 * `consentText` captures the exact wording shown at the time of consent
 * (a snapshot, not a reference) so the record remains valid even if the
 * privacy notice is revised later.
 */
export interface ConsentEntry {
  readonly id: string;
  readonly tenantId: TenantId;
  /** Participant who gave consent; `null` for pre-registration anonymous consent. */
  readonly participantId: string | null;
  /** Exact wording displayed to the participant at the moment of consent. */
  readonly consentText: string;
  /** Version tag for the privacy notice in effect (e.g. `"v1.0"`). */
  readonly privacyPolicyVersion: string;
  /** Mechanism of consent capture (e.g. `"form_checkbox"`). */
  readonly method: string;
  readonly givenAt: Date;
}

/**
 * Write-only port for recording explicit consent events.
 *
 * @remarks
 * Consent records are append-only (RA 10173). There is deliberately no
 * read or delete method on this port — reads for DPA compliance tooling
 * will be added in the participant-profile feature.
 */
export interface ConsentRepositoryPort {
  /**
   * Appends a new consent record.
   *
   * @param entry - The consent event to persist.
   * @returns `ok(void)` on success, or a domain error.
   */
  record(entry: ConsentEntry): Promise<Result<void, DomainError>>;
}
