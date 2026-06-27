import { describe, it, expect } from 'vitest';
import { Money } from '@domain/value-objects/money';

describe('Money', () => {
  describe('create — valid inputs', () => {
    it('accepts zero centavos', () => {
      const result = Money.create(0);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.centavos).toBe(0);
    });

    it('accepts a positive integer', () => {
      const result = Money.create(1000);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.centavos).toBe(1000);
    });

    it('accepts a large integer (e.g. ₱100,000)', () => {
      const result = Money.create(10_000_000);
      expect(result.ok).toBe(true);
    });
  });

  describe('create — invalid inputs', () => {
    it('rejects a decimal value', () => {
      const result = Money.create(10.5);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('amount');
    });

    it('rejects a negative integer', () => {
      const result = Money.create(-1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('amount');
    });

    it('rejects NaN', () => {
      const result = Money.create(NaN);
      expect(result.ok).toBe(false);
    });

    it('rejects Infinity', () => {
      const result = Money.create(Infinity);
      expect(result.ok).toBe(false);
    });
  });

  describe('add', () => {
    it('returns a new Money with the summed centavo amount', () => {
      const a = Money.create(500);
      const b = Money.create(300);
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        const sum = a.value.add(b.value);
        expect(sum.centavos).toBe(800);
      }
    });

    it('does not mutate either operand', () => {
      const a = Money.create(500);
      const b = Money.create(300);
      if (a.ok && b.ok) {
        a.value.add(b.value);
        expect(a.value.centavos).toBe(500);
        expect(b.value.centavos).toBe(300);
      }
    });
  });

  describe('equals', () => {
    it('returns true for equal amounts', () => {
      const a = Money.create(1000);
      const b = Money.create(1000);
      if (a.ok && b.ok) expect(a.value.equals(b.value)).toBe(true);
    });

    it('returns false for different amounts', () => {
      const a = Money.create(1000);
      const b = Money.create(999);
      if (a.ok && b.ok) expect(a.value.equals(b.value)).toBe(false);
    });
  });

  describe('toString', () => {
    it('formats zero as ₱0.00', () => {
      const result = Money.create(0);
      if (result.ok) expect(result.value.toString()).toBe('₱0.00');
    });

    it('formats 100 centavos as ₱1.00', () => {
      const result = Money.create(100);
      if (result.ok) expect(result.value.toString()).toBe('₱1.00');
    });

    it('formats 1050 centavos as ₱10.50', () => {
      const result = Money.create(1050);
      if (result.ok) expect(result.value.toString()).toBe('₱10.50');
    });
  });
});
