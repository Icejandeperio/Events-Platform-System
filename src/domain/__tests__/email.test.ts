import { describe, it, expect } from 'vitest';
import { Email } from '@domain/value-objects/email';

describe('Email', () => {
  describe('create — valid inputs', () => {
    it('accepts a standard email address', () => {
      const result = Email.create('user@example.com');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('user@example.com');
    });

    it('normalizes to lowercase', () => {
      const result = Email.create('User@Example.COM');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('user@example.com');
    });

    it('trims surrounding whitespace', () => {
      const result = Email.create('  test@domain.ph  ');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('test@domain.ph');
    });

    it('accepts a plus-addressed email', () => {
      const result = Email.create('user+tag@example.com');
      expect(result.ok).toBe(true);
    });

    it('accepts a subdomain email', () => {
      const result = Email.create('a@b.c.d');
      expect(result.ok).toBe(true);
    });
  });

  describe('create — invalid inputs', () => {
    it('rejects an empty string', () => {
      const result = Email.create('');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('email');
    });

    it('rejects a string without @', () => {
      const result = Email.create('notanemail');
      expect(result.ok).toBe(false);
    });

    it('rejects a string without a domain part after the dot', () => {
      const result = Email.create('user@domain.');
      expect(result.ok).toBe(false);
    });

    it('rejects a string with spaces in the local part', () => {
      const result = Email.create('user name@example.com');
      expect(result.ok).toBe(false);
    });

    it('rejects a string with no TLD separator', () => {
      const result = Email.create('user@domain');
      expect(result.ok).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for two identical emails', () => {
      const a = Email.create('user@example.com');
      const b = Email.create('USER@EXAMPLE.COM');
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) expect(a.value.equals(b.value)).toBe(true);
    });

    it('returns false for different emails', () => {
      const a = Email.create('alice@example.com');
      const b = Email.create('bob@example.com');
      if (a.ok && b.ok) expect(a.value.equals(b.value)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the normalized email string', () => {
      const result = Email.create('User@Example.COM');
      if (result.ok) expect(result.value.toString()).toBe('user@example.com');
    });
  });
});
