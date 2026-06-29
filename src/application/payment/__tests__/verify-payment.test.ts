import { describe, it, expect, beforeEach } from 'vitest';
import { VerifyPayment } from '@application/payment/use-cases/verify-payment';
import type { VerifyPaymentDeps } from '@application/payment/use-cases/verify-payment';
import { InMemoryPaymentRepository } from '@infrastructure/payment/fakes/in-memory-payment-repository';
import { InMemoryRegistrationRepository } from '@infrastructure/registration/fakes/in-memory-registration-repository';
import { InMemoryAuditLog } from '@infrastructure/audit/fakes/in-memory-audit-log';
import { StubClock } from '@infrastructure/clock/fakes/stub-clock';
import { TenantId } from '@domain/value-objects/tenant-id';
import { Money } from '@domain/value-objects/money';
import { Payment } from '@domain/entities/payment';
import { Registration } from '@domain/entities/registration';

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────
const TENANT_RAW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAYMENT_ID = 'pppppppp-pppp-4ppp-8ppp-pppppppppppp';
const REGISTRATION_ID = 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr';
const STAFF_ID = 'ssssssss-ssss-4sss-8sss-ssssssssssss';
const PARTICIPANT_ID = 'dddddddd-dddd-4ddd-4ddd-dddddddddddd';

const TENANT = TenantId.create(TENANT_RAW);
if (!TENANT.ok) throw new Error('Bad fixture tenant ID');
const tenant = TENANT.value;

const AMOUNT = Money.create(50000);
if (!AMOUNT.ok) throw new Error('Bad fixture amount');
const amount = AMOUNT.value;

const NOW = new Date('2026-01-15T10:00:00.000Z');

// ── Test fixtures ─────────────────────────────────────────────────────────────
let paymentRepo: InMemoryPaymentRepository;
let registrationRepo: InMemoryRegistrationRepository;
let auditLog: InMemoryAuditLog;
let clock: StubClock;
let useCase: VerifyPayment;

function seedSubmittedPayment(): void {
  const payment = Payment.from({
    id: PAYMENT_ID,
    tenantId: tenant,
    registrationId: REGISTRATION_ID,
    amount,
    status: 'SUBMITTED',
    proofKey: 'tenants/a/payments/proof-key',
    createdAt: NOW,
    updatedAt: NOW,
  });
  paymentRepo['records'].set(`${tenant.value}:${PAYMENT_ID}`, payment);
}

function seedPendingRegistration(): void {
  const reg = Registration.from({
    id: REGISTRATION_ID,
    tenantId: tenant,
    participantId: PARTICIPANT_ID,
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
  auditLog = new InMemoryAuditLog();
  clock = new StubClock(NOW);

  const deps: VerifyPaymentDeps = {
    payments: paymentRepo,
    registrations: registrationRepo,
    auditLog,
    clock,
  };
  useCase = new VerifyPayment(deps);
});

describe('VerifyPayment', () => {
  describe('CONFIRM decision', () => {
    it('transitions SUBMITTED → CONFIRMED and confirms the registration', async () => {
      seedSubmittedPayment();
      seedPendingRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'CONFIRM',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe('CONFIRMED');

      // Registration should also be confirmed
      const regResult = await registrationRepo.findById(REGISTRATION_ID, tenant);
      expect(regResult.ok).toBe(true);
      if (regResult.ok) expect(regResult.value.status).toBe('confirmed');
    });

    it('writes an audit log entry unconditionally on CONFIRM', async () => {
      seedSubmittedPayment();
      seedPendingRegistration();

      await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'CONFIRM',
      });

      expect(auditLog.size).toBe(1);
      const entry = auditLog.entries[0];
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(entry.action).toBe('payment.confirmed');
      expect(entry.resourceType).toBe('payment');
      expect(entry.resourceId).toBe(PAYMENT_ID);
      expect(entry.actorId).toBe(STAFF_ID);
      expect(entry.tenantId).toBe(tenant);
      expect(entry.metadata?.['decision']).toBe('CONFIRM');
      expect(entry.occurredAt).toEqual(NOW);
    });
  });

  describe('REJECT decision', () => {
    it('transitions SUBMITTED → REJECTED with the given reason', async () => {
      seedSubmittedPayment();
      seedPendingRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'REJECT',
        rejectionReason: 'Image is too blurry to read.',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe('REJECTED');

      // Registration stays pending after rejection
      const regResult = await registrationRepo.findById(REGISTRATION_ID, tenant);
      expect(regResult.ok).toBe(true);
      if (regResult.ok) expect(regResult.value.status).toBe('pending');
    });

    it('writes an audit log entry unconditionally on REJECT', async () => {
      seedSubmittedPayment();
      seedPendingRegistration();

      await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'REJECT',
        rejectionReason: 'Blurry image',
      });

      expect(auditLog.size).toBe(1);
      const entry = auditLog.entries[0];
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(entry.action).toBe('payment.rejected');
      expect(entry.metadata?.['decision']).toBe('REJECT');
      expect(entry.metadata?.['rejectionReason']).toBe('Blurry image');
    });

    it('rejects REJECT without a reason', async () => {
      seedSubmittedPayment();
      seedPendingRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'REJECT',
        rejectionReason: '',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Rejection reason is required/);
      // No audit entry written — operation failed before persistence
      expect(auditLog.size).toBe(0);
    });

    it('rejects REJECT with blank-only reason (whitespace)', async () => {
      seedSubmittedPayment();
      seedPendingRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'REJECT',
        rejectionReason: '   ',
      });

      expect(result.ok).toBe(false);
      expect(auditLog.size).toBe(0);
    });

    it('rejects REJECT when rejectionReason is missing', async () => {
      seedSubmittedPayment();
      seedPendingRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'REJECT',
        // rejectionReason intentionally omitted
      });

      expect(result.ok).toBe(false);
      expect(auditLog.size).toBe(0);
    });
  });

  describe('state guards', () => {
    it('rejects CONFIRM on a PENDING payment', async () => {
      const pending = Payment.from({
        id: PAYMENT_ID,
        tenantId: tenant,
        registrationId: REGISTRATION_ID,
        amount,
        status: 'PENDING',
        createdAt: NOW,
        updatedAt: NOW,
      });
      paymentRepo['records'].set(`${tenant.value}:${PAYMENT_ID}`, pending);
      seedPendingRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'CONFIRM',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Cannot confirm/);
      // No audit entry on failure
      expect(auditLog.size).toBe(0);
    });

    it('rejects CONFIRM on an already-CONFIRMED payment', async () => {
      const confirmed = Payment.from({
        id: PAYMENT_ID,
        tenantId: tenant,
        registrationId: REGISTRATION_ID,
        amount,
        status: 'CONFIRMED',
        proofKey: 'k',
        verifiedBy: STAFF_ID,
        verifiedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      });
      paymentRepo['records'].set(`${tenant.value}:${PAYMENT_ID}`, confirmed);
      seedPendingRegistration();

      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'CONFIRM',
      });

      expect(result.ok).toBe(false);
      expect(auditLog.size).toBe(0);
    });

    it('rejects if the payment does not exist', async () => {
      // Nothing seeded
      const result = await useCase.execute({
        tenantId: tenant,
        paymentId: PAYMENT_ID,
        verifierId: STAFF_ID,
        decision: 'CONFIRM',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Payment/);
      expect(auditLog.size).toBe(0);
    });
  });
});
