import { describe, it, expect, beforeEach } from 'vitest';
import { SubmitPaymentProof } from '@application/payment/use-cases/submit-payment-proof';
import type { SubmitPaymentProofDeps } from '@application/payment/use-cases/submit-payment-proof';
import { InMemoryPaymentRepository } from '@infrastructure/payment/fakes/in-memory-payment-repository';
import { InMemoryRegistrationRepository } from '@infrastructure/registration/fakes/in-memory-registration-repository';
import { InMemoryFileStorage } from '@infrastructure/storage/fakes/in-memory-file-storage';
import { StubClock } from '@infrastructure/clock/fakes/stub-clock';
import { SequentialIdFake } from '@infrastructure/id/fakes/sequential-id';
import { TenantId } from '@domain/value-objects/tenant-id';
import { Money } from '@domain/value-objects/money';
import { Payment } from '@domain/entities/payment';
import { Registration } from '@domain/entities/registration';
import type { FileUpload } from '@application/storage/ports/file-storage.port';

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────
const TENANT_RAW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAYMENT_ID = 'pppppppp-pppp-4ppp-8ppp-pppppppppppp';
const REGISTRATION_ID = 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr';
const PARTICIPANT_ID = 'dddddddd-dddd-4ddd-4ddd-dddddddddddd';
const OTHER_PARTICIPANT_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const TENANT = TenantId.create(TENANT_RAW);
if (!TENANT.ok) throw new Error('Bad fixture tenant ID');
const tenant = TENANT.value;

const AMOUNT = Money.create(50000);
if (!AMOUNT.ok) throw new Error('Bad fixture amount');
const amount = AMOUNT.value;

const NOW = new Date('2026-01-15T10:00:00.000Z');

function makeValidFile(overrides: Partial<FileUpload> = {}): FileUpload {
  return {
    buffer: Buffer.from('fake-image-bytes'),
    mimeType: 'image/jpeg',
    originalName: 'proof.jpg',
    sizeBytes: 16,
    ...overrides,
  };
}

// ── Test fixtures ─────────────────────────────────────────────────────────────
let paymentRepo: InMemoryPaymentRepository;
let registrationRepo: InMemoryRegistrationRepository;
let fileStorage: InMemoryFileStorage;
let clock: StubClock;
let idFake: SequentialIdFake;
let useCase: SubmitPaymentProof;

function seedPendingPayment(status: 'PENDING' | 'REJECTED' = 'PENDING'): void {
  const payment = Payment.from({
    id: PAYMENT_ID,
    tenantId: tenant,
    registrationId: REGISTRATION_ID,
    amount,
    status,
    ...(status === 'REJECTED'
      ? { proofKey: 'old-key', verifiedBy: 'staff-1', verifiedAt: NOW, rejectionReason: 'Blurry' }
      : {}),
    createdAt: NOW,
    updatedAt: NOW,
  });
  paymentRepo['records'].set(`${tenant.value}:${PAYMENT_ID}`, payment);
}

function seedRegistration(participantId = PARTICIPANT_ID): void {
  const reg = Registration.from({
    id: REGISTRATION_ID,
    tenantId: tenant,
    participantId,
    eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    pricingTierId: null,
    status: 'pending',
    createdAt: NOW,
    updatedAt: NOW,
  });
  registrationRepo['records'].set(`${tenant.value}:${REGISTRATION_ID}`, reg);
}

beforeEach(() => {
  paymentRepo = new InMemoryPaymentRepository();
  registrationRepo = new InMemoryRegistrationRepository();
  fileStorage = new InMemoryFileStorage();
  clock = new StubClock(NOW);
  idFake = new SequentialIdFake();

  const deps: SubmitPaymentProofDeps = {
    payments: paymentRepo,
    registrations: registrationRepo,
    fileStorage,
    clock,
    id: idFake,
  };
  useCase = new SubmitPaymentProof(deps);
});

describe('SubmitPaymentProof', () => {
  describe('happy path', () => {
    it('transitions PENDING → SUBMITTED and stores the file', async () => {
      seedPendingPayment('PENDING');
      seedRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: PARTICIPANT_ID,
        file: makeValidFile(),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe('SUBMITTED');
      expect(fileStorage.size).toBe(1);
    });

    it('allows re-upload from REJECTED state', async () => {
      seedPendingPayment('REJECTED');
      seedRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: PARTICIPANT_ID,
        file: makeValidFile({ mimeType: 'application/pdf', originalName: 'proof.pdf' }),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe('SUBMITTED');
    });

    it('stores the file under a tenant-scoped key', async () => {
      seedPendingPayment();
      seedRegistration();

      await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: PARTICIPANT_ID,
        file: makeValidFile(),
      });

      const storedKeys = [...fileStorage['files'].keys()];
      expect(storedKeys[0]).toMatch(new RegExp(`^tenants/${TENANT_RAW}/payments/`));
    });
  });

  describe('file validation', () => {
    it('rejects an invalid MIME type (e.g. GIF)', async () => {
      seedPendingPayment();
      seedRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: PARTICIPANT_ID,
        file: makeValidFile({ mimeType: 'image/gif', originalName: 'proof.gif' }),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/not allowed/);
        expect((result.error as { field?: string }).field).toBe('file');
      }
    });

    it('rejects a file exceeding 8 MB', async () => {
      seedPendingPayment();
      seedRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: PARTICIPANT_ID,
        file: makeValidFile({ sizeBytes: 9 * 1024 * 1024, buffer: Buffer.alloc(0) }),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/8 MB/);
    });

    it('accepts PNG files', async () => {
      seedPendingPayment();
      seedRegistration();
      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: PARTICIPANT_ID,
        file: makeValidFile({ mimeType: 'image/png', originalName: 'proof.png' }),
      });
      expect(result.ok).toBe(true);
    });

    it('accepts PDF files', async () => {
      seedPendingPayment();
      seedRegistration();
      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: PARTICIPANT_ID,
        file: makeValidFile({ mimeType: 'application/pdf', originalName: 'proof.pdf' }),
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('BOLA guard', () => {
    it('rejects a caller who does not own the registration', async () => {
      seedPendingPayment();
      seedRegistration(PARTICIPANT_ID); // owned by PARTICIPANT_ID

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: OTHER_PARTICIPANT_ID, // wrong caller
        file: makeValidFile(),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Payment/);
    });
  });

  describe('state guard', () => {
    it('rejects proof submission for a CONFIRMED payment', async () => {
      const confirmed = Payment.from({
        id: PAYMENT_ID,
        tenantId: tenant,
        registrationId: REGISTRATION_ID,
        amount,
        status: 'CONFIRMED',
        proofKey: 'k',
        verifiedBy: 'staff-1',
        verifiedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      });
      paymentRepo['records'].set(`${tenant.value}:${PAYMENT_ID}`, confirmed);
      seedRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        participantId: PARTICIPANT_ID,
        file: makeValidFile(),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/CONFIRMED/);
    });
  });
});
