import { describe, it, expect } from 'vitest';
import { PhoneNumber } from '@domain/value-objects/phone-number';

describe('PhoneNumber', () => {
  describe('create — valid inputs', () => {
    it('accepts a local-format mobile number (09...)', () => {
      const result = PhoneNumber.create('09171234567');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('+639171234567');
    });

    it('normalizes local 09 prefix to E.164 +639', () => {
      const result = PhoneNumber.create('09999999999');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('+639999999999');
    });

    it('accepts E.164 format (+639...)', () => {
      const result = PhoneNumber.create('+639171234567');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('+639171234567');
    });

    it('strips spaces before validating', () => {
      const result = PhoneNumber.create('0917 123 4567');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('+639171234567');
    });

    it('strips dashes before validating', () => {
      const result = PhoneNumber.create('0917-123-4567');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('+639171234567');
    });
  });

  describe('create — invalid inputs', () => {
    it('rejects an empty string', () => {
      const result = PhoneNumber.create('');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('phone');
    });

    it('rejects a landline number (02...)', () => {
      const result = PhoneNumber.create('021234567');
      expect(result.ok).toBe(false);
    });

    it('rejects an international number for another country', () => {
      const result = PhoneNumber.create('+1-800-555-0000');
      expect(result.ok).toBe(false);
    });

    it('rejects too-short a number', () => {
      const result = PhoneNumber.create('091712345');
      expect(result.ok).toBe(false);
    });

    it('rejects too-long a number', () => {
      const result = PhoneNumber.create('091712345678');
      expect(result.ok).toBe(false);
    });

    it('rejects alphabetic characters', () => {
      const result = PhoneNumber.create('09abc234567');
      expect(result.ok).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for the same number in different formats', () => {
      const local = PhoneNumber.create('09171234567');
      const e164 = PhoneNumber.create('+639171234567');
      expect(local.ok && e164.ok).toBe(true);
      if (local.ok && e164.ok) expect(local.value.equals(e164.value)).toBe(true);
    });

    it('returns false for different numbers', () => {
      const a = PhoneNumber.create('09171234567');
      const b = PhoneNumber.create('09289999999');
      if (a.ok && b.ok) expect(a.value.equals(b.value)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the E.164 normalized string', () => {
      const result = PhoneNumber.create('09171234567');
      if (result.ok) expect(result.value.toString()).toBe('+639171234567');
    });
  });
});
