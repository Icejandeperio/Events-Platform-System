import type { Result } from '@shared/result';
import type { DomainError, NotFoundError } from '@shared/errors';
import type { Registration } from '@domain/entities/registration';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * Persistence port for `Registration` entities.
 *
 * @remarks
 * All methods are tenant-scoped: a registration in tenant B is invisible
 * to a caller operating under tenant A's context (enforced by RLS in the
 * Drizzle adapter; mirrored by key-prefix isolation in the in-memory fake).
 */
export interface RegistrationRepositoryPort {
  /**
   * Finds a registration by its UUIDv4, scoped to the given tenant.
   *
   * @param id - The registration's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The registration, or `NotFoundError` if absent for this tenant.
   */
  findById(id: string, tenantId: TenantId): Promise<Result<Registration, NotFoundError>>;

  /**
   * Finds an existing registration for a specific participant + event pair.
   *
   * @param participantId - The participant's UUIDv4.
   * @param eventId - The event's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The existing registration, `null` if none exists, or a domain error.
   */
  findByParticipantAndEvent(
    participantId: string,
    eventId: string,
    tenantId: TenantId,
  ): Promise<Result<Registration | null, DomainError>>;

  /**
   * Counts non-cancelled registrations for an event, used for capacity checks.
   *
   * @param eventId - The event's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The count of `pending` and `confirmed` registrations.
   */
  countActiveByEvent(eventId: string, tenantId: TenantId): Promise<Result<number, DomainError>>;

  /**
   * Persists a registration (insert or update keyed by `id`).
   *
   * @param registration - The registration entity to persist.
   * @returns `ok(void)` on success, or a domain error.
   */
  save(registration: Registration): Promise<Result<void, DomainError>>;
}
