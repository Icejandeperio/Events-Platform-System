import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import type { DomainError } from '@shared/errors';
import type { Email } from '@domain/value-objects/email';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type {
  ParticipantRecord,
  ParticipantRepositoryPort,
} from '@application/participants/ports/participant-repository.port';

/**
 * In-memory implementation of `ParticipantRepositoryPort` for unit tests.
 *
 * @remarks
 * Stores records in a `Map` keyed by `"<tenantId>:<id>"` so cross-tenant lookups
 * are naturally impossible (mirrors the RLS-based isolation in the DB adapter).
 * Use the `size` getter in test assertions to verify record counts.
 */
export class InMemoryParticipantRepository implements ParticipantRepositoryPort {
  private readonly records = new Map<string, ParticipantRecord>();

  /**
   * Finds a participant by ID within the given tenant scope.
   *
   * @param id - The participant's UUIDv4.
   * @param tenantId - The tenant scope; different tenants never see each other's records.
   * @returns The participant record, or `NotFoundError` if absent for this tenant.
   */
  async findById(
    id: string,
    tenantId: TenantId,
  ): Promise<Result<ParticipantRecord, NotFoundError>> {
    const record = this.records.get(`${tenantId.value}:${id}`);
    if (!record) {
      return err(new NotFoundError('Participant', id));
    }
    return ok(record);
  }

  /**
   * Looks up a participant by email within the given tenant.
   *
   * @param email - The email to search for.
   * @param tenantId - The tenant scope.
   * @returns The matching record (or `null` if absent); never fails in this fake.
   */
  async findByEmail(
    email: Email,
    tenantId: TenantId,
  ): Promise<Result<ParticipantRecord | null, DomainError>> {
    const match = [...this.records.values()].find(
      (r) => r.tenantId.equals(tenantId) && r.email.equals(email),
    );
    return ok(match ?? null);
  }

  /**
   * Persists a participant record (insert or update by `"<tenantId>:<id>"` key).
   *
   * @param record - The full participant record to write.
   * @returns `ok(void)` always in this in-memory implementation.
   */
  async save(record: ParticipantRecord): Promise<Result<void, DomainError>> {
    this.records.set(`${record.tenantId.value}:${record.id}`, record);
    return ok(undefined);
  }

  /**
   * Looks up a participant by their linked `user.id` within the given tenant.
   *
   * @param userId - The Better Auth user ID to look up.
   * @param tenantId - The tenant scope.
   * @returns The matching record, `null` if absent; never fails in this fake.
   *
   * @remarks
   * An empty `userId` returns `null` immediately — a falsy value must never
   * match a participant whose `userId` is undefined/null (null-comparison guard).
   */
  async findByUserId(
    userId: string,
    tenantId: TenantId,
  ): Promise<Result<ParticipantRecord | null, DomainError>> {
    if (!userId) return ok(null);
    const match = [...this.records.values()].find(
      (r) => r.tenantId.equals(tenantId) && r.userId === userId,
    );
    return ok(match ?? null);
  }

  /**
   * Removes a participant from the in-memory store.
   *
   * @param id - The participant's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns `ok(void)` on success, or `NotFoundError` if the record does not exist.
   */
  async delete(id: string, tenantId: TenantId): Promise<Result<void, NotFoundError>> {
    const key = `${tenantId.value}:${id}`;
    if (!this.records.has(key)) {
      return err(new NotFoundError('Participant', id));
    }
    this.records.delete(key);
    return ok(undefined);
  }

  /** Total number of participant records across all tenants. Useful in test assertions. */
  get size(): number {
    return this.records.size;
  }

  /** Clears all records. Call in `beforeEach` to reset state between tests. */
  clear(): void {
    this.records.clear();
  }
}
