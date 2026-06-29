import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { ValidationError } from '@shared/errors';
import type { Email } from '@domain/value-objects/email';
import type { PhoneNumber } from '@domain/value-objects/phone-number';
import type { TenantId } from '@domain/value-objects/tenant-id';

/** Props required to construct a `Participant` entity. */
export interface ParticipantProps {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: Email;
  readonly phone?: PhoneNumber;
  /** Better Auth user ID; absent for the guest-registration flow. */
  readonly userId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A person who registers for an event.
 *
 * @remarks
 * Entities have identity (`id`) and are compared by it. All mutations produce
 * a new instance — the entity is effectively immutable after construction.
 * `email` and `phone` are RA 10173 personal data — never log their values.
 */
export class Participant {
  private constructor(private readonly props: ParticipantProps) {}

  /** @returns The participant's UUIDv4 identifier. */
  get id(): string {
    return this.props.id;
  }

  /** @returns The tenant this participant belongs to. */
  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  /** @returns The participant's given name. */
  get firstName(): string {
    return this.props.firstName;
  }

  /** @returns The participant's family name. */
  get lastName(): string {
    return this.props.lastName;
  }

  /** @returns The participant's email address. */
  get email(): Email {
    return this.props.email;
  }

  /** @returns The participant's Philippine mobile number, or `undefined` if not provided. */
  get phone(): PhoneNumber | undefined {
    return this.props.phone;
  }

  /** @returns The Better Auth user ID, or `undefined` for guest registrations. */
  get userId(): string | undefined {
    return this.props.userId;
  }

  /** @returns The timestamp when this participant record was first created. */
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** @returns The timestamp of the most recent update to this participant record. */
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** @returns Full display name in "Given Family" order. */
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }

  /**
   * Validates and constructs a `Participant` entity.
   *
   * @param props - Participant properties; `firstName` and `lastName` are trimmed.
   * @returns `ok(Participant)` on success, or `err(ValidationError)` for blank names.
   */
  static create(props: ParticipantProps): Result<Participant, ValidationError> {
    const firstName = props.firstName.trim();
    const lastName = props.lastName.trim();

    if (!firstName) {
      return err(new ValidationError('First name is required.', 'firstName'));
    }
    if (!lastName) {
      return err(new ValidationError('Last name is required.', 'lastName'));
    }

    const normalized: ParticipantProps = {
      id: props.id,
      tenantId: props.tenantId,
      firstName,
      lastName,
      email: props.email,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
    if (props.phone !== undefined) {
      (normalized as { phone?: PhoneNumber }).phone = props.phone;
    }
    if (props.userId !== undefined) {
      (normalized as { userId?: string }).userId = props.userId;
    }

    return ok(new Participant(normalized));
  }
}
