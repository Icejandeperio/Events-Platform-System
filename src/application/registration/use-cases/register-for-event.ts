import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { ConflictError, DomainError, NotFoundError } from '@shared/errors';
import { Money } from '@domain/value-objects/money';
import { Participant } from '@domain/entities/participant';
import { Registration } from '@domain/entities/registration';
import { Payment } from '@domain/entities/payment';
import type { Email } from '@domain/value-objects/email';
import type { PhoneNumber } from '@domain/value-objects/phone-number';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type { EventRepositoryPort } from '@application/events/ports/event-repository.port';
import type {
  ParticipantRepositoryPort,
  ParticipantRecord,
} from '@application/participants/ports/participant-repository.port';
import type { RegistrationRepositoryPort } from '@application/registration/ports/registration-repository.port';
import type { PaymentRepositoryPort } from '@application/payment/ports/payment-repository.port';
import type { ConsentRepositoryPort } from '@application/consent/ports/consent-repository.port';
import type { ClockPort } from '@application/clock/ports/clock.port';
import type { IdPort } from '@application/id/ports/id.port';

/** Command input for the `RegisterForEvent` use case. */
export interface RegisterForEventCommand {
  /** Tenant in whose context the registration is being created. */
  readonly tenantId: TenantId;
  /** The event to register for. */
  readonly eventId: string;
  /** Pricing tier selected; `null` for free events with no tiers. */
  readonly pricingTierId: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: Email;
  /** Optional — not all registrations include a phone number. */
  readonly phone: PhoneNumber | null;
  /**
   * Better Auth `user.id` of the registering user — set when the participant
   * has a platform account; omit for the guest flow.
   */
  readonly userId?: string;
  /** Exact text of the privacy notice displayed to the participant. */
  readonly consentText: string;
  /** Version tag of the privacy notice in effect (e.g. `"v1.0"`). */
  readonly privacyPolicyVersion: string;
}

/** Output returned on successful registration. */
export interface RegisterForEventResult {
  readonly participantId: string;
  readonly registrationId: string;
  readonly paymentId: string;
  /** Payment amount in integer centavos (₱1 = 100). */
  readonly amountCentavos: number;
}

/** Port dependencies for `RegisterForEvent`. */
export interface RegisterForEventDeps {
  readonly events: EventRepositoryPort;
  readonly participants: ParticipantRepositoryPort;
  readonly registrations: RegistrationRepositoryPort;
  readonly payments: PaymentRepositoryPort;
  readonly consent: ConsentRepositoryPort;
  readonly clock: ClockPort;
  readonly id: IdPort;
}

/**
 * Creates a registration for a participant attending an event.
 *
 * @remarks
 * Responsibilities (in order):
 * 1. Assert the event is `open` and accepting registrations.
 * 2. Resolve the pricing tier amount from the event record (not the client).
 * 3. Check capacity — reject if `capacityLimit` is reached.
 * 4. Find an existing participant by email or create a new one.
 * 5. Reject duplicate registration (same participant + event).
 * 6. Create `Registration` (pending) and `Payment` (PENDING) entities.
 * 7. Persist both and record the participant's explicit consent.
 *
 * Authorization: any authenticated user (or guest) may register.
 * Tenant isolation: all repository calls are scoped to `cmd.tenantId`.
 */
export class RegisterForEvent {
  /**
   * @param deps - Port implementations injected by the composition root.
   */
  constructor(private readonly deps: RegisterForEventDeps) {}

  /**
   * Executes the registration flow.
   *
   * @param cmd - The registration command containing participant and event details.
   * @returns The created IDs and payment amount, or a typed domain error.
   */
  async execute(
    cmd: RegisterForEventCommand,
  ): Promise<Result<RegisterForEventResult, DomainError>> {
    const now = this.deps.clock.now();

    // 1. Load event — RLS and tenant check happen in the adapter.
    const eventResult = await this.deps.events.findById(cmd.eventId, cmd.tenantId);
    if (!eventResult.ok) return err(eventResult.error);
    const event = eventResult.value;

    // 2. Guard: event must be open.
    if (event.status !== 'open') {
      return err(
        new DomainError(`Event is not accepting registrations (status: '${event.status}').`),
      );
    }

    // 3. Resolve pricing tier and amount from the authoritative event record.
    let amount: Money;
    if (cmd.pricingTierId !== null) {
      const tier = event.pricingTiers.find((t) => t.id === cmd.pricingTierId && t.isActive);
      if (tier === undefined) {
        return err(new NotFoundError('PricingTier', cmd.pricingTierId));
      }
      amount = tier.amount;
    } else {
      const freeResult = Money.create(0);
      // Money.create(0) can only fail for non-integers or negatives — 0 is always valid.
      if (!freeResult.ok) return err(freeResult.error);
      amount = freeResult.value;
    }

    // 4. Capacity check.
    if (event.capacityLimit !== null) {
      const countResult = await this.deps.registrations.countActiveByEvent(
        cmd.eventId,
        cmd.tenantId,
      );
      if (!countResult.ok) return err(countResult.error);
      if (countResult.value >= event.capacityLimit) {
        return err(
          new ConflictError(
            `Event has reached its registration capacity of ${event.capacityLimit}.`,
          ),
        );
      }
    }

    // 5. Find or create participant.
    const existingResult = await this.deps.participants.findByEmail(cmd.email, cmd.tenantId);
    if (!existingResult.ok) return err(existingResult.error);

    let participantId: string;
    if (existingResult.value !== null) {
      participantId = existingResult.value.id;
    } else {
      const pId = this.deps.id.generate();
      // Validate via domain entity before persisting.
      const pEntityResult = Participant.create({
        id: pId,
        tenantId: cmd.tenantId,
        firstName: cmd.firstName,
        lastName: cmd.lastName,
        email: cmd.email,
        createdAt: now,
        updatedAt: now,
        ...(cmd.phone !== null ? { phone: cmd.phone } : {}),
      });
      if (!pEntityResult.ok) return err(pEntityResult.error);

      const pRecord: ParticipantRecord = {
        id: pEntityResult.value.id,
        tenantId: pEntityResult.value.tenantId,
        firstName: pEntityResult.value.firstName,
        lastName: pEntityResult.value.lastName,
        email: pEntityResult.value.email,
        createdAt: pEntityResult.value.createdAt,
        updatedAt: pEntityResult.value.updatedAt,
        ...(pEntityResult.value.phone !== undefined ? { phone: pEntityResult.value.phone } : {}),
        // Link the platform account when one is provided (guest flow omits this).
        ...(cmd.userId !== undefined ? { userId: cmd.userId } : {}),
      };

      const savePResult = await this.deps.participants.save(pRecord);
      if (!savePResult.ok) return err(savePResult.error);
      participantId = pId;
    }

    // 6. Reject duplicate registration.
    const dupResult = await this.deps.registrations.findByParticipantAndEvent(
      participantId,
      cmd.eventId,
      cmd.tenantId,
    );
    if (!dupResult.ok) return err(dupResult.error);
    if (dupResult.value !== null) {
      return err(new ConflictError(`This participant is already registered for this event.`));
    }

    // 7. Create and persist Registration + Payment entities.
    const registrationId = this.deps.id.generate();
    const registration = Registration.from({
      id: registrationId,
      tenantId: cmd.tenantId,
      participantId,
      eventId: cmd.eventId,
      pricingTierId: cmd.pricingTierId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    const paymentId = this.deps.id.generate();
    const payment = Payment.from({
      id: paymentId,
      tenantId: cmd.tenantId,
      registrationId,
      amount,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });

    const regSave = await this.deps.registrations.save(registration);
    if (!regSave.ok) return err(regSave.error);

    const paySave = await this.deps.payments.save(payment);
    if (!paySave.ok) return err(paySave.error);

    // 8. Record explicit consent (RA 10173 requirement).
    const consentSave = await this.deps.consent.record({
      id: this.deps.id.generate(),
      tenantId: cmd.tenantId,
      participantId,
      consentText: cmd.consentText,
      privacyPolicyVersion: cmd.privacyPolicyVersion,
      method: 'form_checkbox',
      givenAt: now,
    });
    if (!consentSave.ok) return err(consentSave.error);

    return ok({
      participantId,
      registrationId,
      paymentId,
      amountCentavos: amount.centavos,
    });
  }
}
