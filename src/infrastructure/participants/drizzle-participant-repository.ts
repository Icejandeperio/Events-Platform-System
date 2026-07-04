import { eq } from 'drizzle-orm';
import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import type { DomainError } from '@shared/errors';
import { TenantId } from '@domain/value-objects/tenant-id';
import { Email } from '@domain/value-objects/email';
import { PhoneNumber } from '@domain/value-objects/phone-number';
import type {
  ParticipantRecord,
  ParticipantRepositoryPort,
} from '@application/participants/ports/participant-repository.port';
import type { AppDb } from '@infrastructure/db/client';
import { withTenantContext } from '@infrastructure/db/tenant-context';
import { participants } from '@infrastructure/db/schema';

/**
 * Drizzle implementation of `ParticipantRepositoryPort`.
 *
 * @remarks
 * All queries run inside a tenant-scoped transaction via `withTenantContext()`.
 * RLS on the `participants` table provides the cross-tenant backstop; the
 * `user_id` ownership check (same-tenant isolation) is application-layer only.
 *
 * `save()` uses an upsert keyed on `id` so the same call handles both create
 * and update without separate code paths.
 */
export class DrizzleParticipantRepository implements ParticipantRepositoryPort {
  /**
   * @param db - Injected Drizzle client; never the global singleton.
   */
  constructor(private readonly db: AppDb) {}

  /**
   * Finds a participant by their UUIDv4, scoped to the given tenant.
   *
   * @param id - The participant's UUIDv4.
   * @param tenantId - The tenant scope; RLS blocks cross-tenant rows.
   * @returns The participant record, or `NotFoundError` if absent for this tenant.
   */
  async findById(
    id: string,
    tenantId: TenantId,
  ): Promise<Result<ParticipantRecord, NotFoundError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [row] = await tx.select().from(participants).where(eq(participants.id, id));
      if (row === undefined) return err(new NotFoundError('Participant', id));
      return ok(rowToRecord(row, tenantId));
    });
  }

  /**
   * Looks up a participant by email within the given tenant.
   *
   * @param email - The email to search for.
   * @param tenantId - The tenant scope.
   * @returns The matching record or `null` if absent.
   */
  async findByEmail(
    email: Email,
    tenantId: TenantId,
  ): Promise<Result<ParticipantRecord | null, DomainError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [row] = await tx.select().from(participants).where(eq(participants.email, email.value));
      return ok(row !== undefined ? rowToRecord(row, tenantId) : null);
    });
  }

  /**
   * Looks up a participant by their linked Better Auth `user.id`.
   *
   * @param userId - The Better Auth user ID (text, not UUID).
   * @param tenantId - The tenant scope.
   * @returns The matching record, `null` if absent, or a domain error.
   *
   * @remarks
   * A falsy `userId` returns `null` immediately — this guards against the
   * SQL null-comparison trap: `WHERE user_id = NULL` returns 0 rows, but an
   * explicit check makes the intent unambiguous and prevents future regressions
   * if the call path changes.
   */
  async findByUserId(
    userId: string,
    tenantId: TenantId,
  ): Promise<Result<ParticipantRecord | null, DomainError>> {
    if (!userId) return ok(null);
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [row] = await tx.select().from(participants).where(eq(participants.userId, userId));
      return ok(row !== undefined ? rowToRecord(row, tenantId) : null);
    });
  }

  /**
   * Persists a participant record (insert or update keyed by `id`).
   *
   * @param record - The full record to write.
   * @returns `ok(void)` on success, or a domain error.
   */
  async save(record: ParticipantRecord): Promise<Result<void, DomainError>> {
    return withTenantContext(this.db, record.tenantId, async (tx) => {
      await tx
        .insert(participants)
        .values({
          id: record.id,
          tenantId: record.tenantId.value,
          userId: record.userId ?? null,
          firstName: record.firstName,
          lastName: record.lastName,
          email: record.email.value,
          phone: record.phone?.value ?? null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .onConflictDoUpdate({
          target: participants.id,
          set: {
            userId: record.userId ?? null,
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email.value,
            phone: record.phone?.value ?? null,
            updatedAt: record.updatedAt,
          },
        });
      return ok(undefined);
    });
  }

  /**
   * Removes a participant by ID from the given tenant.
   *
   * @param id - The participant's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns `ok(void)` on success, or `NotFoundError` if absent.
   */
  async delete(id: string, tenantId: TenantId): Promise<Result<void, NotFoundError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const deleted = await tx
        .delete(participants)
        .where(eq(participants.id, id))
        .returning({ id: participants.id });
      if (deleted.length === 0) return err(new NotFoundError('Participant', id));
      return ok(undefined);
    });
  }
}

/**
 * Reconstitutes a `ParticipantRecord` from a raw database row.
 *
 * @param row - Raw row from the `participants` table.
 * @param tenantId - Tenant ID (already resolved from the RLS context).
 * @returns A fully validated `ParticipantRecord`.
 */
function rowToRecord(row: typeof participants.$inferSelect, tenantId: TenantId): ParticipantRecord {
  const emailResult = Email.create(row.email);
  if (!emailResult.ok) {
    throw new Error(`Corrupt email in participants row ${row.id}: ${row.email}`);
  }

  let phone: PhoneNumber | undefined;
  if (row.phone !== null) {
    const phoneResult = PhoneNumber.create(row.phone);
    if (!phoneResult.ok) {
      throw new Error(`Corrupt phone in participants row ${row.id}: ${row.phone}`);
    }
    phone = phoneResult.value;
  }

  return {
    id: row.id,
    tenantId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: emailResult.value,
    ...(row.userId !== null ? { userId: row.userId } : {}),
    ...(phone !== undefined ? { phone } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
