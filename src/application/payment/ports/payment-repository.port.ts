import type { Result } from '@shared/result';
import type { DomainError, NotFoundError } from '@shared/errors';
import type { Payment } from '@domain/entities/payment';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * Persistence port for `Payment` entities.
 *
 * @remarks
 * All methods are tenant-scoped. Cross-tenant access is prevented both by the
 * RLS policy in the Drizzle adapter and by key-prefix isolation in the fake.
 */
export interface PaymentRepositoryPort {
  /**
   * Finds a payment by its UUIDv4, scoped to the given tenant.
   *
   * @param id - The payment's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The payment entity, or `NotFoundError` if absent for this tenant.
   */
  findById(id: string, tenantId: TenantId): Promise<Result<Payment, NotFoundError>>;

  /**
   * Finds the payment linked to a given registration.
   *
   * @param registrationId - The registration's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The payment, `null` if none exists yet, or a domain error.
   */
  findByRegistrationId(
    registrationId: string,
    tenantId: TenantId,
  ): Promise<Result<Payment | null, DomainError>>;

  /**
   * Lists all payments in `SUBMITTED` status for staff verification queue.
   *
   * @param tenantId - The tenant scope.
   * @returns An ordered list of submitted payments (oldest first).
   */
  listSubmitted(tenantId: TenantId): Promise<Result<Payment[], DomainError>>;

  /**
   * Persists a payment entity (insert or update keyed by `id`).
   *
   * @param payment - The payment entity to persist.
   * @returns `ok(void)` on success, or a domain error.
   */
  save(payment: Payment): Promise<Result<void, DomainError>>;
}
