import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { DomainError } from '@shared/errors';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * Lifecycle states for a registration.
 *
 * @remarks
 * State machine: `pending → confirmed | cancelled`.
 * A confirmed registration cannot be cancelled via this use-case layer
 * (requires a manual staff override with an audit trail).
 */
export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled';

/** Props for constructing or reconstituting a `Registration` entity. */
export interface RegistrationProps {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly participantId: string;
  readonly eventId: string;
  readonly pricingTierId: string | null;
  readonly status: RegistrationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * The record of a participant signing up for an event.
 *
 * @remarks
 * Enforces the registration status state machine:
 * `pending → confirmed | cancelled`
 * Transitions produce a new instance; the original is not mutated.
 * A confirmed registration cannot be cancelled through normal use-case flow —
 * that path requires an explicit staff override with an audit log entry.
 */
export class Registration {
  private constructor(private readonly props: RegistrationProps) {}

  /** @returns The registration's UUIDv4 identifier. */
  get id(): string {
    return this.props.id;
  }

  /** @returns The tenant this registration belongs to. */
  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  /** @returns The ID of the registered participant. */
  get participantId(): string {
    return this.props.participantId;
  }

  /** @returns The ID of the event registered for. */
  get eventId(): string {
    return this.props.eventId;
  }

  /** @returns The selected pricing tier ID, or `null` for free events with no tiers. */
  get pricingTierId(): string | null {
    return this.props.pricingTierId;
  }

  /** @returns Current status in the registration lifecycle. */
  get status(): RegistrationStatus {
    return this.props.status;
  }

  /** @returns The timestamp when this registration was created. */
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** @returns The timestamp of the most recent status change. */
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Constructs or reconstitutes a `Registration` from props.
   *
   * @param props - Registration properties including the current status.
   * @returns A new `Registration` instance.
   */
  static from(props: RegistrationProps): Registration {
    return new Registration(props);
  }

  /**
   * Transitions `pending → confirmed` when a payment is verified.
   *
   * @param now - Current timestamp for the `updatedAt` field.
   * @returns The confirmed `Registration`, or `DomainError` if not in `pending` state.
   */
  confirm(now: Date): Result<Registration, DomainError> {
    if (this.props.status !== 'pending') {
      return err(
        new DomainError(
          `Cannot confirm a registration with status '${this.props.status}'. Expected 'pending'.`,
        ),
      );
    }
    return ok(
      new Registration({
        id: this.props.id,
        tenantId: this.props.tenantId,
        participantId: this.props.participantId,
        eventId: this.props.eventId,
        pricingTierId: this.props.pricingTierId,
        status: 'confirmed',
        createdAt: this.props.createdAt,
        updatedAt: now,
      }),
    );
  }

  /**
   * Transitions `pending → cancelled`.
   *
   * @param now - Current timestamp for the `updatedAt` field.
   * @returns The cancelled `Registration`, or `DomainError` if already confirmed.
   */
  cancel(now: Date): Result<Registration, DomainError> {
    if (this.props.status === 'confirmed') {
      return err(
        new DomainError(
          `Cannot cancel a confirmed registration. A staff override with an audit log entry is required.`,
        ),
      );
    }
    if (this.props.status === 'cancelled') {
      return err(new DomainError(`Registration is already cancelled.`));
    }
    return ok(
      new Registration({
        id: this.props.id,
        tenantId: this.props.tenantId,
        participantId: this.props.participantId,
        eventId: this.props.eventId,
        pricingTierId: this.props.pricingTierId,
        status: 'cancelled',
        createdAt: this.props.createdAt,
        updatedAt: now,
      }),
    );
  }
}
