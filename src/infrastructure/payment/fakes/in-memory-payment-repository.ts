import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import type { DomainError } from '@shared/errors';
import type { Payment } from '@domain/entities/payment';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type { PaymentRepositoryPort } from '@application/payment/ports/payment-repository.port';

/**
 * In-memory implementation of `PaymentRepositoryPort` for unit tests.
 *
 * @remarks
 * Keyed by `"<tenantId>:<id>"` to mirror cross-tenant RLS isolation.
 * `listSubmitted` returns records with `status === 'SUBMITTED'` sorted by `createdAt` ascending.
 */
export class InMemoryPaymentRepository implements PaymentRepositoryPort {
  private readonly records = new Map<string, Payment>();

  /**
   * Finds a payment by ID within the given tenant scope.
   *
   * @param id - The payment's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The payment entity, or `NotFoundError` if absent.
   */
  async findById(id: string, tenantId: TenantId): Promise<Result<Payment, NotFoundError>> {
    const record = this.records.get(`${tenantId.value}:${id}`);
    if (record === undefined) {
      return err(new NotFoundError('Payment', id));
    }
    return ok(record);
  }

  /**
   * Finds the payment linked to a given registration.
   *
   * @param registrationId - The registration's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The matching payment, `null` if none, or a domain error.
   */
  async findByRegistrationId(
    registrationId: string,
    tenantId: TenantId,
  ): Promise<Result<Payment | null, DomainError>> {
    const match = [...this.records.values()].find(
      (p) => p.tenantId.equals(tenantId) && p.registrationId === registrationId,
    );
    return ok(match ?? null);
  }

  /**
   * Lists all `SUBMITTED` payments for the staff verification queue, oldest first.
   *
   * @param tenantId - The tenant scope.
   * @returns An ordered list of submitted payments.
   */
  async listSubmitted(tenantId: TenantId): Promise<Result<Payment[], DomainError>> {
    const submitted = [...this.records.values()]
      .filter((p) => p.tenantId.equals(tenantId) && p.status === 'SUBMITTED')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return ok(submitted);
  }

  /**
   * Persists a payment entity (insert or update keyed by `"<tenantId>:<id>"`).
   *
   * @param payment - The payment entity to persist.
   * @returns `ok(void)` always in this in-memory implementation.
   */
  async save(payment: Payment): Promise<Result<void, DomainError>> {
    this.records.set(`${payment.tenantId.value}:${payment.id}`, payment);
    return ok(undefined);
  }

  /** Total number of payment records across all tenants. Useful in test assertions. */
  get size(): number {
    return this.records.size;
  }

  /** Clears all records. Call in `beforeEach` to reset state between tests. */
  clear(): void {
    this.records.clear();
  }
}
