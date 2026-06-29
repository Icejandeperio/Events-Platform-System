import { describe, it, expect } from 'vitest';
import { Registration } from '@domain/entities/registration';
import { TenantId } from '@domain/value-objects/tenant-id';

const TENANT = TenantId.create('00000000-0000-4000-8000-000000000001');
if (!TENANT.ok) throw new Error('Invalid fixture tenant ID');
const tenantId = TENANT.value;

const BASE = {
  id: '10000000-0000-4000-8000-000000000001',
  tenantId,
  participantId: '20000000-0000-4000-8000-000000000001',
  eventId: '30000000-0000-4000-8000-000000000001',
  pricingTierId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('Registration — state machine', () => {
  describe('confirm()', () => {
    it('transitions pending → confirmed', () => {
      const reg = Registration.from({ ...BASE, status: 'pending' });
      const now = new Date('2026-01-02T00:00:00.000Z');
      const result = reg.confirm(now);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('confirmed');
        expect(result.value.updatedAt).toEqual(now);
      }
    });

    it('rejects confirm on an already-confirmed registration', () => {
      const reg = Registration.from({ ...BASE, status: 'confirmed' });
      const result = reg.confirm(new Date());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Cannot confirm/);
    });

    it('rejects confirm on a cancelled registration', () => {
      const reg = Registration.from({ ...BASE, status: 'cancelled' });
      const result = reg.confirm(new Date());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Cannot confirm/);
    });
  });

  describe('cancel()', () => {
    it('transitions pending → cancelled', () => {
      const reg = Registration.from({ ...BASE, status: 'pending' });
      const now = new Date('2026-01-02T00:00:00.000Z');
      const result = reg.cancel(now);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('cancelled');
        expect(result.value.updatedAt).toEqual(now);
      }
    });

    it('rejects cancel on a confirmed registration', () => {
      const reg = Registration.from({ ...BASE, status: 'confirmed' });
      const result = reg.cancel(new Date());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Cannot cancel a confirmed/);
    });

    it('rejects cancel on an already-cancelled registration', () => {
      const reg = Registration.from({ ...BASE, status: 'cancelled' });
      const result = reg.cancel(new Date());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/already cancelled/);
    });
  });

  describe('getters', () => {
    it('exposes all props', () => {
      const reg = Registration.from({ ...BASE, status: 'pending' });
      expect(reg.id).toBe(BASE.id);
      expect(reg.tenantId).toBe(tenantId);
      expect(reg.participantId).toBe(BASE.participantId);
      expect(reg.eventId).toBe(BASE.eventId);
      expect(reg.pricingTierId).toBeNull();
      expect(reg.status).toBe('pending');
      expect(reg.createdAt).toEqual(BASE.createdAt);
      expect(reg.updatedAt).toEqual(BASE.updatedAt);
    });
  });
});
