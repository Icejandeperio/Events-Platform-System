import { and, eq, ne, count } from 'drizzle-orm';
import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import type { DomainError } from '@shared/errors';
import { Registration } from '@domain/entities/registration';
import type { RegistrationStatus } from '@domain/entities/registration';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type { RegistrationRepositoryPort } from '@application/registration/ports/registration-repository.port';
import type { AppDb } from '@infrastructure/db/client';
import { withTenantContext } from '@infrastructure/db/tenant-context';
import { registrations } from '@infrastructure/db/schema';

/**
 * Drizzle implementation of `RegistrationRepositoryPort`.
 *
 * @remarks
 * All queries run inside a tenant-scoped transaction via `withTenantContext()`.
 * RLS on the `registrations` table guarantees cross-tenant rows are invisible
 * even without an explicit `tenant_id` WHERE clause.
 *
 * `save()` uses an upsert (INSERT … ON CONFLICT DO UPDATE) keyed on the
 * primary key so the same method handles both initial persist and state transitions.
 */
export class DrizzleRegistrationRepository implements RegistrationRepositoryPort {
  /**
   * @param db - Injected Drizzle client; never the global singleton.
   */
  constructor(private readonly db: AppDb) {}

  /**
   * Finds a registration by its UUIDv4, scoped to the given tenant.
   *
   * @param id - The registration's UUIDv4.
   * @param tenantId - The tenant scope; cross-tenant rows are blocked by RLS.
   * @returns The reconstituted `Registration` entity, or `NotFoundError` if absent.
   */
  async findById(id: string, tenantId: TenantId): Promise<Result<Registration, NotFoundError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [row] = await tx.select().from(registrations).where(eq(registrations.id, id));
      if (row === undefined) {
        return err(new NotFoundError('Registration', id));
      }
      return ok(rowToRegistration(row, tenantId));
    });
  }

  /**
   * Finds an existing registration for a specific participant + event pair.
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
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(registrations)
        .where(
          and(eq(registrations.participantId, participantId), eq(registrations.eventId, eventId)),
        );
      return ok(row !== undefined ? rowToRegistration(row, tenantId) : null);
    });
  }

  /**
   * Counts non-cancelled registrations for an event, used for capacity checks.
   *
   * @param eventId - The event's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The count of `pending` and `confirmed` registrations.
   */
  async countActiveByEvent(
    eventId: string,
    tenantId: TenantId,
  ): Promise<Result<number, DomainError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [result] = await tx
        .select({ count: count() })
        .from(registrations)
        .where(and(eq(registrations.eventId, eventId), ne(registrations.status, 'cancelled')));
      return ok(result?.count ?? 0);
    });
  }

  /**
   * Persists a registration entity (insert or update keyed by `id`).
   *
   * @param registration - The entity to persist.
   * @returns `ok(void)` on success, or a domain error.
   */
  async save(registration: Registration): Promise<Result<void, DomainError>> {
    return withTenantContext(this.db, registration.tenantId, async (tx) => {
      await tx
        .insert(registrations)
        .values({
          id: registration.id,
          tenantId: registration.tenantId.value,
          participantId: registration.participantId,
          eventId: registration.eventId,
          pricingTierId: registration.pricingTierId,
          status: registration.status,
          createdAt: registration.createdAt,
          updatedAt: registration.updatedAt,
        })
        .onConflictDoUpdate({
          target: registrations.id,
          set: {
            status: registration.status,
            updatedAt: registration.updatedAt,
          },
        });
      return ok(undefined);
    });
  }
}

/**
 * Reconstitutes a `Registration` entity from a database row.
 *
 * @param row - Raw row from the `registrations` table.
 * @param tenantId - Tenant ID (already resolved from the session context).
 * @returns A `Registration` domain entity.
 */
function rowToRegistration(
  row: typeof registrations.$inferSelect,
  tenantId: TenantId,
): Registration {
  return Registration.from({
    id: row.id,
    tenantId,
    participantId: row.participantId,
    eventId: row.eventId,
    pricingTierId: row.pricingTierId ?? null,
    status: row.status as RegistrationStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
