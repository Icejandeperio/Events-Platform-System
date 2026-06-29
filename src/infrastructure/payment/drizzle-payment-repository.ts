import { eq, and } from 'drizzle-orm';
import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import type { DomainError } from '@shared/errors';
import { Payment } from '@domain/entities/payment';
import type { PaymentStatus } from '@domain/entities/payment';
import { Money } from '@domain/value-objects/money';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type { PaymentRepositoryPort } from '@application/payment/ports/payment-repository.port';
import type { AppDb } from '@infrastructure/db/client';
import { withTenantContext } from '@infrastructure/db/tenant-context';
import { payments } from '@infrastructure/db/schema';

/**
 * Drizzle implementation of `PaymentRepositoryPort`.
 *
 * @remarks
 * All queries run inside a tenant-scoped transaction via `withTenantContext()`.
 * The `proof_url` column stores the internal storage key (NOT a public URL) —
 * the entity calls it `proofKey` (SECURITY.md §4).
 *
 * `save()` uses an upsert keyed on the primary key to handle both initial
 * creation (PENDING) and all subsequent state transitions (SUBMITTED → CONFIRMED | REJECTED).
 */
export class DrizzlePaymentRepository implements PaymentRepositoryPort {
  /**
   * @param db - Injected Drizzle client; never the global singleton.
   */
  constructor(private readonly db: AppDb) {}

  /**
   * Finds a payment by its UUIDv4, scoped to the given tenant.
   *
   * @param id - The payment's UUIDv4.
   * @param tenantId - The tenant scope; cross-tenant rows are blocked by RLS.
   * @returns The reconstituted `Payment` entity, or `NotFoundError` if absent.
   */
  async findById(id: string, tenantId: TenantId): Promise<Result<Payment, NotFoundError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [row] = await tx.select().from(payments).where(eq(payments.id, id));
      if (row === undefined) {
        return err(new NotFoundError('Payment', id));
      }
      return ok(rowToPayment(row, tenantId));
    });
  }

  /**
   * Finds the payment linked to a given registration.
   *
   * @param registrationId - The registration's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The payment entity, `null` if none, or a domain error.
   */
  async findByRegistrationId(
    registrationId: string,
    tenantId: TenantId,
  ): Promise<Result<Payment | null, DomainError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.registrationId, registrationId)));
      return ok(row !== undefined ? rowToPayment(row, tenantId) : null);
    });
  }

  /**
   * Lists all `SUBMITTED` payments in the staff verification queue, oldest first.
   *
   * @param tenantId - The tenant scope.
   * @returns An ordered list of submitted payments.
   */
  async listSubmitted(tenantId: TenantId): Promise<Result<Payment[], DomainError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(payments)
        .where(eq(payments.status, 'SUBMITTED'))
        .orderBy(payments.createdAt);
      return ok(rows.map((r) => rowToPayment(r, tenantId)));
    });
  }

  /**
   * Persists a payment entity (insert or update keyed by `id`).
   *
   * @param payment - The entity to persist.
   * @returns `ok(void)` on success, or a domain error.
   */
  async save(payment: Payment): Promise<Result<void, DomainError>> {
    return withTenantContext(this.db, payment.tenantId, async (tx) => {
      await tx
        .insert(payments)
        .values({
          id: payment.id,
          tenantId: payment.tenantId.value,
          registrationId: payment.registrationId,
          amount: payment.amount.centavos,
          status: payment.status,
          // 'proofKey' in the entity is stored as 'proof_url' in the DB schema.
          proofUrl: payment.proofKey ?? null,
          verifiedBy: payment.verifiedBy ?? null,
          verifiedAt: payment.verifiedAt ?? null,
          rejectionReason: payment.rejectionReason ?? null,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        })
        .onConflictDoUpdate({
          target: payments.id,
          set: {
            status: payment.status,
            proofUrl: payment.proofKey ?? null,
            verifiedBy: payment.verifiedBy ?? null,
            verifiedAt: payment.verifiedAt ?? null,
            rejectionReason: payment.rejectionReason ?? null,
            updatedAt: payment.updatedAt,
          },
        });
      return ok(undefined);
    });
  }
}

/**
 * Reconstitutes a `Payment` entity from a database row.
 *
 * @param row - Raw row from the `payments` table.
 * @param tenantId - Tenant ID (already resolved from the session context).
 * @returns A `Payment` domain entity.
 */
function rowToPayment(row: typeof payments.$inferSelect, tenantId: TenantId): Payment {
  const amountResult = Money.create(row.amount);
  // DB amounts are written only via use cases that validated them — a
  // failure here means data corruption, so throw rather than silently drop.
  if (!amountResult.ok) {
    throw new Error(`Corrupt amount in payments row ${row.id}: ${row.amount}`);
  }

  return Payment.from({
    id: row.id,
    tenantId,
    registrationId: row.registrationId,
    amount: amountResult.value,
    status: row.status as PaymentStatus,
    // Map DB 'proof_url' column → entity 'proofKey' (SECURITY.md §4 — storage key, not URL).
    ...(row.proofUrl !== null ? { proofKey: row.proofUrl } : {}),
    ...(row.verifiedBy !== null ? { verifiedBy: row.verifiedBy } : {}),
    ...(row.verifiedAt !== null ? { verifiedAt: row.verifiedAt } : {}),
    ...(row.rejectionReason !== null ? { rejectionReason: row.rejectionReason } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
