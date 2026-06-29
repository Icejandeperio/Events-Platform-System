import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import type { DomainError } from '@shared/errors';
import type { Registration } from '@domain/entities/registration';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type { RegistrationRepositoryPort } from '@application/registration/ports/registration-repository.port';

/**
 * In-memory implementation of `RegistrationRepositoryPort` for unit tests.
 *
 * @remarks
 * Keyed by `"<tenantId>:<id>"` to mirror cross-tenant RLS isolation.
 * `countActiveByEvent` counts records with `status !== 'cancelled'`.
 */
export class InMemoryRegistrationRepository implements RegistrationRepositoryPort {
  private readonly records = new Map<string, Registration>();

  /**
   * Finds a registration by ID within the given tenant scope.
   *
   * @param id - The registration's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The registration entity, or `NotFoundError` if absent.
   */
  async findById(id: string, tenantId: TenantId): Promise<Result<Registration, NotFoundError>> {
    const record = this.records.get(`${tenantId.value}:${id}`);
    if (record === undefined) {
      return err(new NotFoundError('Registration', id));
    }
    return ok(record);
  }

  /**
   * Looks up an existing registration for a participant + event pair.
   *
   * @param participantId - The participant's UUIDv4.
   * @param eventId - The event's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The matching registration, `null` if none, or a domain error.
   */
  async findByParticipantAndEvent(
    participantId: string,
    eventId: string,
    tenantId: TenantId,
  ): Promise<Result<Registration | null, DomainError>> {
    const match = [...this.records.values()].find(
      (r) =>
        r.tenantId.equals(tenantId) && r.participantId === participantId && r.eventId === eventId,
    );
    return ok(match ?? null);
  }

  /**
   * Counts non-cancelled registrations for an event.
   *
   * @param eventId - The event's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The count of `pending` and `confirmed` registrations.
   */
  async countActiveByEvent(
    eventId: string,
    tenantId: TenantId,
  ): Promise<Result<number, DomainError>> {
    const count = [...this.records.values()].filter(
      (r) => r.tenantId.equals(tenantId) && r.eventId === eventId && r.status !== 'cancelled',
    ).length;
    return ok(count);
  }

  /**
   * Persists a registration entity (insert or update keyed by `"<tenantId>:<id>"`).
   *
   * @param registration - The registration entity to persist.
   * @returns `ok(void)` always in this in-memory implementation.
   */
  async save(registration: Registration): Promise<Result<void, DomainError>> {
    this.records.set(`${registration.tenantId.value}:${registration.id}`, registration);
    return ok(undefined);
  }

  /** Total number of registration records across all tenants. Useful in test assertions. */
  get size(): number {
    return this.records.size;
  }

  /** Clears all records. Call in `beforeEach` to reset state between tests. */
  clear(): void {
    this.records.clear();
  }
}
