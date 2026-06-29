import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { DomainError, ValidationError } from '@shared/errors';
import type { Money } from '@domain/value-objects/money';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * Lifecycle states for a payment.
 *
 * @remarks
 * State machine (GLOSSARY):
 * `PENDING → SUBMITTED → CONFIRMED | REJECTED`
 * A `REJECTED` payment returns to `SUBMITTED` when the participant re-uploads proof.
 */
export type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';

/** Props for constructing or reconstituting a `Payment` entity. */
export interface PaymentProps {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly registrationId: string;
  readonly amount: Money;
  readonly status: PaymentStatus;
  /** Internal storage key for the proof file; absent until first `submit()`. */
  readonly proofKey?: string;
  /** ID of the staff member who confirmed or rejected this payment. */
  readonly verifiedBy?: string;
  /** Timestamp of staff verification; absent until confirmed or rejected. */
  readonly verifiedAt?: Date;
  /** Reason given on rejection; absent unless status is `REJECTED`. */
  readonly rejectionReason?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A record of money owed or paid for a registration.
 *
 * @remarks
 * Enforces the payment status state machine from GLOSSARY.md:
 * `PENDING → SUBMITTED → CONFIRMED | REJECTED`
 * A `REJECTED` payment returns to `SUBMITTED` when the participant re-uploads proof.
 * All amounts are integer centavos — never floats (SECURITY.md §8).
 * `proofKey` is a storage reference, never a public URL (SECURITY.md §4).
 */
export class Payment {
  private constructor(private readonly props: PaymentProps) {}

  /** @returns The payment's UUIDv4 identifier. */
  get id(): string {
    return this.props.id;
  }

  /** @returns The tenant this payment belongs to. */
  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  /** @returns The ID of the registration this payment is for. */
  get registrationId(): string {
    return this.props.registrationId;
  }

  /** @returns The payment amount as an immutable `Money` value object. */
  get amount(): Money {
    return this.props.amount;
  }

  /** @returns Current status in the payment lifecycle. */
  get status(): PaymentStatus {
    return this.props.status;
  }

  /** @returns Internal storage key for the proof file, or `undefined` if not yet uploaded. */
  get proofKey(): string | undefined {
    return this.props.proofKey;
  }

  /** @returns ID of the staff member who verified this payment, or `undefined`. */
  get verifiedBy(): string | undefined {
    return this.props.verifiedBy;
  }

  /** @returns Timestamp of staff verification, or `undefined` if not yet verified. */
  get verifiedAt(): Date | undefined {
    return this.props.verifiedAt;
  }

  /** @returns The rejection reason, or `undefined` if not rejected. */
  get rejectionReason(): string | undefined {
    return this.props.rejectionReason;
  }

  /** @returns The timestamp when this payment record was created. */
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** @returns The timestamp of the most recent status change. */
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Constructs or reconstitutes a `Payment` from props.
   *
   * @param props - Payment properties including the current status.
   * @returns A new `Payment` instance.
   */
  static from(props: PaymentProps): Payment {
    return new Payment(props);
  }

  /**
   * Transitions `PENDING → SUBMITTED` (first upload) or `REJECTED → SUBMITTED` (re-upload).
   *
   * @param proofKey - Internal storage key for the uploaded proof file.
   * @param now - Current timestamp for the `updatedAt` field.
   * @returns The updated `Payment`, or `DomainError` if the current status does not allow submission.
   */
  submit(proofKey: string, now: Date): Result<Payment, DomainError> {
    if (this.props.status !== 'PENDING' && this.props.status !== 'REJECTED') {
      return err(
        new DomainError(
          `Cannot submit proof for a payment with status '${this.props.status}'. Expected 'PENDING' or 'REJECTED'.`,
        ),
      );
    }
    return ok(
      new Payment({
        id: this.props.id,
        tenantId: this.props.tenantId,
        registrationId: this.props.registrationId,
        amount: this.props.amount,
        status: 'SUBMITTED',
        proofKey,
        // rejectionReason, verifiedBy, verifiedAt are intentionally absent on re-submit
        createdAt: this.props.createdAt,
        updatedAt: now,
      }),
    );
  }

  /**
   * Transitions `SUBMITTED → CONFIRMED`.
   *
   * @param verifiedBy - ID of the staff member confirming the payment.
   * @param now - Current timestamp.
   * @returns The confirmed `Payment`, or `DomainError` if not in `SUBMITTED` state.
   */
  confirm(verifiedBy: string, now: Date): Result<Payment, DomainError> {
    if (this.props.status !== 'SUBMITTED') {
      return err(
        new DomainError(
          `Cannot confirm a payment with status '${this.props.status}'. Expected 'SUBMITTED'.`,
        ),
      );
    }
    const newProps: PaymentProps = {
      id: this.props.id,
      tenantId: this.props.tenantId,
      registrationId: this.props.registrationId,
      amount: this.props.amount,
      status: 'CONFIRMED',
      verifiedBy,
      verifiedAt: now,
      createdAt: this.props.createdAt,
      updatedAt: now,
    };
    if (this.props.proofKey !== undefined) {
      (newProps as { proofKey?: string }).proofKey = this.props.proofKey;
    }
    return ok(new Payment(newProps));
  }

  /**
   * Transitions `SUBMITTED → REJECTED`.
   *
   * @param verifiedBy - ID of the staff member rejecting the payment.
   * @param reason - Non-empty rejection reason shown to the participant on re-upload.
   * @param now - Current timestamp.
   * @returns The rejected `Payment`, or `DomainError` if not in `SUBMITTED` state or reason is blank.
   */
  reject(
    verifiedBy: string,
    reason: string,
    now: Date,
  ): Result<Payment, ValidationError | DomainError> {
    if (this.props.status !== 'SUBMITTED') {
      return err(
        new DomainError(
          `Cannot reject a payment with status '${this.props.status}'. Expected 'SUBMITTED'.`,
        ),
      );
    }
    if (!reason.trim()) {
      return err(new ValidationError('Rejection reason is required.', 'rejectionReason'));
    }
    const newProps: PaymentProps = {
      id: this.props.id,
      tenantId: this.props.tenantId,
      registrationId: this.props.registrationId,
      amount: this.props.amount,
      status: 'REJECTED',
      rejectionReason: reason.trim(),
      verifiedBy,
      verifiedAt: now,
      createdAt: this.props.createdAt,
      updatedAt: now,
    };
    if (this.props.proofKey !== undefined) {
      (newProps as { proofKey?: string }).proofKey = this.props.proofKey;
    }
    return ok(new Payment(newProps));
  }
}
