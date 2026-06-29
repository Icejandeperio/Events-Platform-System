import { describe, it, expect } from 'vitest';
import { Payment } from '@domain/entities/payment';
import { TenantId } from '@domain/value-objects/tenant-id';
import { Money } from '@domain/value-objects/money';

const TENANT = TenantId.create('00000000-0000-4000-8000-000000000001');
if (!TENANT.ok) throw new Error('Invalid fixture tenant ID');
const tenantId = TENANT.value;

const AMOUNT = Money.create(50000);
if (!AMOUNT.ok) throw new Error('Invalid fixture amount');
const amount = AMOUNT.value;

const BASE = {
  id: '10000000-0000-4000-8000-000000000002',
  tenantId,
  registrationId: '10000000-0000-4000-8000-000000000003',
  amount,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('Payment — state machine', () => {
  describe('submit()', () => {
    it('transitions PENDING → SUBMITTED', () => {
      const payment = Payment.from({ ...BASE, status: 'PENDING' });
      const now = new Date('2026-01-02T00:00:00.000Z');
      const result = payment.submit('tenants/x/payments/proof.jpg', now);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('SUBMITTED');
        expect(result.value.proofKey).toBe('tenants/x/payments/proof.jpg');
        expect(result.value.updatedAt).toEqual(now);
      }
    });

    it('transitions REJECTED → SUBMITTED (re-upload clears rejection reason)', () => {
      const payment = Payment.from({
        ...BASE,
        status: 'REJECTED',
        proofKey: 'old-key',
        verifiedBy: 'staff-1',
        verifiedAt: new Date('2026-01-01T12:00:00.000Z'),
        rejectionReason: 'Blurry image',
      });
      const result = payment.submit('new-key', new Date());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('SUBMITTED');
        expect(result.value.proofKey).toBe('new-key');
        // Rejection state is cleared on re-submit
        expect(result.value.rejectionReason).toBeUndefined();
        expect(result.value.verifiedBy).toBeUndefined();
        expect(result.value.verifiedAt).toBeUndefined();
      }
    });

    it('rejects submit from SUBMITTED', () => {
      const payment = Payment.from({ ...BASE, status: 'SUBMITTED', proofKey: 'k' });
      const result = payment.submit('new-key', new Date());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Cannot submit proof/);
    });

    it('rejects submit from CONFIRMED', () => {
      const payment = Payment.from({
        ...BASE,
        status: 'CONFIRMED',
        proofKey: 'k',
        verifiedBy: 's',
        verifiedAt: new Date(),
      });
      const result = payment.submit('new-key', new Date());
      expect(result.ok).toBe(false);
    });
  });

  describe('confirm()', () => {
    it('transitions SUBMITTED → CONFIRMED preserving proofKey', () => {
      const payment = Payment.from({ ...BASE, status: 'SUBMITTED', proofKey: 'proof-key' });
      const now = new Date('2026-01-03T00:00:00.000Z');
      const result = payment.confirm('staff-1', now);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('CONFIRMED');
        expect(result.value.verifiedBy).toBe('staff-1');
        expect(result.value.verifiedAt).toEqual(now);
        expect(result.value.proofKey).toBe('proof-key');
      }
    });

    it('rejects confirm from PENDING', () => {
      const payment = Payment.from({ ...BASE, status: 'PENDING' });
      const result = payment.confirm('staff-1', new Date());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Cannot confirm/);
    });

    it('rejects confirm from REJECTED', () => {
      const payment = Payment.from({
        ...BASE,
        status: 'REJECTED',
        proofKey: 'k',
        verifiedBy: 's',
        verifiedAt: new Date(),
        rejectionReason: 'r',
      });
      const result = payment.confirm('staff-1', new Date());
      expect(result.ok).toBe(false);
    });
  });

  describe('reject()', () => {
    it('transitions SUBMITTED → REJECTED with reason', () => {
      const payment = Payment.from({ ...BASE, status: 'SUBMITTED', proofKey: 'proof-key' });
      const now = new Date('2026-01-03T00:00:00.000Z');
      const result = payment.reject('staff-1', 'Blurry image', now);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('REJECTED');
        expect(result.value.rejectionReason).toBe('Blurry image');
        expect(result.value.verifiedBy).toBe('staff-1');
        expect(result.value.proofKey).toBe('proof-key');
      }
    });

    it('rejects reject with blank reason', () => {
      const payment = Payment.from({ ...BASE, status: 'SUBMITTED', proofKey: 'k' });
      const result = payment.reject('staff-1', '   ', new Date());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Rejection reason is required/);
    });

    it('rejects reject from PENDING', () => {
      const payment = Payment.from({ ...BASE, status: 'PENDING' });
      const result = payment.reject('staff-1', 'reason', new Date());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Cannot reject/);
    });

    it('rejects reject from CONFIRMED', () => {
      const payment = Payment.from({
        ...BASE,
        status: 'CONFIRMED',
        proofKey: 'k',
        verifiedBy: 's',
        verifiedAt: new Date(),
      });
      const result = payment.reject('staff-1', 'reason', new Date());
      expect(result.ok).toBe(false);
    });
  });

  describe('getters', () => {
    it('exposes all props', () => {
      const payment = Payment.from({ ...BASE, status: 'PENDING' });
      expect(payment.id).toBe(BASE.id);
      expect(payment.tenantId).toBe(tenantId);
      expect(payment.registrationId).toBe(BASE.registrationId);
      expect(payment.amount).toBe(amount);
      expect(payment.status).toBe('PENDING');
      expect(payment.proofKey).toBeUndefined();
      expect(payment.createdAt).toEqual(BASE.createdAt);
    });
  });
});
