import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { DomainError, ValidationError } from '@shared/errors';
import type { PaymentStatus } from '@domain/entities/payment';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type { PaymentRepositoryPort } from '@application/payment/ports/payment-repository.port';
import type { RegistrationRepositoryPort } from '@application/registration/ports/registration-repository.port';
import type { AuditLogPort } from '@application/audit/ports/audit-log.port';
import type { ClockPort } from '@application/clock/ports/clock.port';

/** Staff decision on a submitted payment. */
export type VerifyDecision = 'CONFIRM' | 'REJECT';

/** Command input for the `VerifyPayment` use case. */
export interface VerifyPaymentCommand {
  /** Tenant in whose context the payment exists. */
  readonly tenantId: TenantId;
  /** The payment to verify. */
  readonly paymentId: string;
  /** Better Auth user ID of the staff member performing the verification. */
  readonly verifierId: string;
  /** Staff decision: confirm or reject the proof. */
  readonly decision: VerifyDecision;
  /**
   * Mandatory when `decision === 'REJECT'`; shown to the participant on re-upload.
   * Must not be blank.
   */
  readonly rejectionReason?: string;
}

/** Output returned on successful verification. */
export interface VerifyPaymentResult {
  readonly paymentId: string;
  readonly status: PaymentStatus;
}

/** Port dependencies for `VerifyPayment`. */
export interface VerifyPaymentDeps {
  readonly payments: PaymentRepositoryPort;
  readonly registrations: RegistrationRepositoryPort;
  readonly auditLog: AuditLogPort;
  readonly clock: ClockPort;
}

/**
 * Staff verification of a submitted payment proof.
 *
 * @remarks
 * Responsibilities (in order):
 * 1. Validate the command (rejection requires a non-blank reason).
 * 2. Load the payment and assert it is in `SUBMITTED` state.
 * 3. Apply the staff decision via the `Payment` entity's state machine.
 * 4. On `CONFIRM`: also transition the parent `Registration` to `confirmed`.
 * 5. Persist the updated entities.
 * 6. **Write an audit log entry unconditionally** (SECURITY.md §7, COMPLIANCE.md §2).
 *
 * Authorization: `staff` or `tenant_admin` role (enforced by the calling API route).
 * Tenant isolation: all repository calls are scoped to `cmd.tenantId`.
 */
export class VerifyPayment {
  /**
   * @param deps - Port implementations injected by the composition root.
   */
  constructor(private readonly deps: VerifyPaymentDeps) {}

  /**
   * Executes the verification flow.
   *
   * @param cmd - The verification command including the staff decision.
   * @returns The updated payment status, or a typed domain error.
   */
  async execute(cmd: VerifyPaymentCommand): Promise<Result<VerifyPaymentResult, DomainError>> {
    // 1. Validate command: rejection requires a non-blank reason.
    if (cmd.decision === 'REJECT') {
      const reason = cmd.rejectionReason;
      if (reason === undefined || !reason.trim()) {
        return err(new ValidationError('Rejection reason is required.', 'rejectionReason'));
      }
    }

    const now = this.deps.clock.now();

    // 2. Load payment — RLS enforces tenant boundary in production adapter.
    const paymentResult = await this.deps.payments.findById(cmd.paymentId, cmd.tenantId);
    if (!paymentResult.ok) return err(paymentResult.error);
    const payment = paymentResult.value;

    // 3. Apply state machine transition via entity method.
    let updatedPaymentResult: Result<typeof payment, DomainError | ValidationError>;
    if (cmd.decision === 'CONFIRM') {
      updatedPaymentResult = payment.confirm(cmd.verifierId, now);
    } else {
      // rejectionReason is guaranteed non-blank by the guard above.
      const reason = cmd.rejectionReason ?? '';
      updatedPaymentResult = payment.reject(cmd.verifierId, reason, now);
    }
    if (!updatedPaymentResult.ok) return err(updatedPaymentResult.error);
    const updatedPayment = updatedPaymentResult.value;

    // 4. On CONFIRM: transition the parent Registration to 'confirmed'.
    if (cmd.decision === 'CONFIRM') {
      const regResult = await this.deps.registrations.findById(
        payment.registrationId,
        cmd.tenantId,
      );
      if (!regResult.ok) return err(regResult.error);

      const confirmedRegResult = regResult.value.confirm(now);
      if (!confirmedRegResult.ok) return err(confirmedRegResult.error);

      const regSave = await this.deps.registrations.save(confirmedRegResult.value);
      if (!regSave.ok) return err(regSave.error);
    }

    // 5. Persist updated payment.
    const paySave = await this.deps.payments.save(updatedPayment);
    if (!paySave.ok) return err(paySave.error);

    // 6. Write audit log unconditionally (SECURITY.md §7, COMPLIANCE.md §2).
    // This MUST happen regardless of CONFIRM or REJECT — do not move into a branch.
    const action = cmd.decision === 'CONFIRM' ? 'payment.confirmed' : 'payment.rejected';
    const metadata: Record<string, unknown> = { decision: cmd.decision };
    if (cmd.decision === 'REJECT' && cmd.rejectionReason !== undefined) {
      metadata['rejectionReason'] = cmd.rejectionReason;
    }
    const auditResult = await this.deps.auditLog.append({
      tenantId: cmd.tenantId,
      actorId: cmd.verifierId,
      action,
      resourceType: 'payment',
      resourceId: cmd.paymentId,
      metadata,
      occurredAt: now,
    });
    if (!auditResult.ok) return err(auditResult.error);

    return ok({ paymentId: cmd.paymentId, status: updatedPayment.status });
  }
}
