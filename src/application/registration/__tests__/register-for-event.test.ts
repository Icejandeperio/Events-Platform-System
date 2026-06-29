import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterForEvent } from '@application/registration/use-cases/register-for-event';
import type { RegisterForEventDeps } from '@application/registration/use-cases/register-for-event';
import { InMemoryEventRepository } from '@infrastructure/events/fakes/in-memory-event-repository';
import { InMemoryParticipantRepository } from '@infrastructure/participants/fakes/in-memory-participant-repository';
import { InMemoryRegistrationRepository } from '@infrastructure/registration/fakes/in-memory-registration-repository';
import { InMemoryPaymentRepository } from '@infrastructure/payment/fakes/in-memory-payment-repository';
import { InMemoryConsentRepository } from '@infrastructure/consent/fakes/in-memory-consent-repository';
import { StubClock } from '@infrastructure/clock/fakes/stub-clock';
import { SequentialIdFake } from '@infrastructure/id/fakes/sequential-id';
import { TenantId } from '@domain/value-objects/tenant-id';
import { Email } from '@domain/value-objects/email';
import { Money } from '@domain/value-objects/money';
import { Registration } from '@domain/entities/registration';
import type { EventRecord } from '@application/events/ports/event-repository.port';

// ── Fixture UUIDs (all valid UUIDv4) ────────────────────────────────────────
const TENANT_A_RAW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TIER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PARTICIPANT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const TENANT_A = TenantId.create(TENANT_A_RAW);
if (!TENANT_A.ok) throw new Error('Bad fixture tenant ID');
const tenantA = TENANT_A.value;

const EMAIL_RESULT = Email.create('alice@example.com');
if (!EMAIL_RESULT.ok) throw new Error('Bad fixture email');
const email = EMAIL_RESULT.value;

const AMOUNT_RESULT = Money.create(50000); // ₱500.00
if (!AMOUNT_RESULT.ok) throw new Error('Bad fixture amount');
const amount = AMOUNT_RESULT.value;

const NOW = new Date('2026-01-15T10:00:00.000Z');

function makeOpenEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: EVENT_ID,
    tenantId: tenantA,
    name: 'PAT Race 2026',
    status: 'open',
    capacityLimit: null,
    pricingTiers: [{ id: TIER_ID, name: 'Standard', amount, isActive: true, availableSlots: null }],
    ...overrides,
  };
}

// ── Test fixtures ─────────────────────────────────────────────────────────────
let eventRepo: InMemoryEventRepository;
let participantRepo: InMemoryParticipantRepository;
let registrationRepo: InMemoryRegistrationRepository;
let paymentRepo: InMemoryPaymentRepository;
let consentRepo: InMemoryConsentRepository;
let clock: StubClock;
let idFake: SequentialIdFake;
let useCase: RegisterForEvent;

beforeEach(() => {
  eventRepo = new InMemoryEventRepository();
  participantRepo = new InMemoryParticipantRepository();
  registrationRepo = new InMemoryRegistrationRepository();
  paymentRepo = new InMemoryPaymentRepository();
  consentRepo = new InMemoryConsentRepository();
  clock = new StubClock(NOW);
  idFake = new SequentialIdFake();

  const deps: RegisterForEventDeps = {
    events: eventRepo,
    participants: participantRepo,
    registrations: registrationRepo,
    payments: paymentRepo,
    consent: consentRepo,
    clock,
    id: idFake,
  };
  useCase = new RegisterForEvent(deps);
});

const BASE_CMD = {
  tenantId: tenantA,
  eventId: EVENT_ID,
  pricingTierId: TIER_ID,
  firstName: 'Alice',
  lastName: 'Reyes',
  email,
  phone: null,
  consentText: 'I agree to the privacy policy.',
  privacyPolicyVersion: 'v1.0',
} as const;

describe('RegisterForEvent', () => {
  describe('happy path', () => {
    it('creates participant, registration, payment, and consent on success', async () => {
      eventRepo.seed(makeOpenEvent());

      const result = await useCase.execute(BASE_CMD);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.participantId).toBe('id-0001');
      expect(result.value.registrationId).toBe('id-0002');
      expect(result.value.paymentId).toBe('id-0003');
      expect(result.value.amountCentavos).toBe(50000);

      expect(participantRepo.size).toBe(1);
      expect(registrationRepo.size).toBe(1);
      expect(paymentRepo.size).toBe(1);
      expect(consentRepo.size).toBe(1);
    });

    it('resolves zero amount for free event (null pricingTierId)', async () => {
      eventRepo.seed(makeOpenEvent({ pricingTiers: [] }));

      const result = await useCase.execute({ ...BASE_CMD, pricingTierId: null });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.amountCentavos).toBe(0);
    });

    it('reuses an existing participant record matched by email', async () => {
      eventRepo.seed(makeOpenEvent());
      // Pre-create the participant (simulates a returning attendee)
      const EMAIL_R = Email.create('alice@example.com');
      if (!EMAIL_R.ok) throw new Error();
      await participantRepo.save({
        id: PARTICIPANT_ID,
        tenantId: tenantA,
        firstName: 'Alice',
        lastName: 'Reyes',
        email: EMAIL_R.value,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const result = await useCase.execute(BASE_CMD);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Participant was not re-created — repo still has 1 record
      expect(participantRepo.size).toBe(1);
      expect(result.value.participantId).toBe(PARTICIPANT_ID);
    });

    it('records consent with the supplied text and policy version', async () => {
      eventRepo.seed(makeOpenEvent());
      await useCase.execute({
        ...BASE_CMD,
        consentText: 'Privacy notice v1.0 shown.',
        privacyPolicyVersion: 'v1.0',
      });
      expect(consentRepo.entries[0]?.consentText).toBe('Privacy notice v1.0 shown.');
      expect(consentRepo.entries[0]?.privacyPolicyVersion).toBe('v1.0');
      expect(consentRepo.entries[0]?.method).toBe('form_checkbox');
    });
  });

  describe('rejections', () => {
    it('rejects if event is not open (draft)', async () => {
      eventRepo.seed(makeOpenEvent({ status: 'draft' }));
      const result = await useCase.execute(BASE_CMD);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/not accepting registrations/);
    });

    it('rejects if event is closed', async () => {
      eventRepo.seed(makeOpenEvent({ status: 'closed' }));
      const result = await useCase.execute(BASE_CMD);
      expect(result.ok).toBe(false);
    });

    it('rejects if pricing tier ID is not found in the event', async () => {
      eventRepo.seed(makeOpenEvent({ pricingTiers: [] }));
      const result = await useCase.execute({ ...BASE_CMD, pricingTierId: TIER_ID });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/PricingTier/);
    });

    it('rejects if capacity is reached', async () => {
      eventRepo.seed(makeOpenEvent({ capacityLimit: 1 }));
      // Pre-fill one registration for tenant A's event
      registrationRepo['records'].set(
        `${tenantA.value}:existing-reg`,
        Registration.from({
          id: 'existing-reg',
          tenantId: tenantA,
          participantId: 'other-participant',
          eventId: EVENT_ID,
          pricingTierId: TIER_ID,
          status: 'pending',
          createdAt: NOW,
          updatedAt: NOW,
        }),
      );

      const result = await useCase.execute(BASE_CMD);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/capacity/);
    });

    it('rejects duplicate registration for the same participant + event', async () => {
      eventRepo.seed(makeOpenEvent());
      // First registration succeeds
      const first = await useCase.execute(BASE_CMD);
      expect(first.ok).toBe(true);
      // Second call with the same email → duplicate
      idFake.reset();
      const second = await useCase.execute(BASE_CMD);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error.message).toMatch(/already registered/);
    });

    it('rejects if event does not exist', async () => {
      // Nothing seeded in eventRepo
      const result = await useCase.execute(BASE_CMD);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Event/);
    });
  });
});
