import { describe, it, expect } from 'vitest';
import { TenantId } from '@domain/value-objects/tenant-id';

const VALID_V4 = '550e8400-e29b-41d4-a716-446655440000';
const VALID_V4_UPPER = '550E8400-E29B-41D4-A716-446655440000';

describe('TenantId', () => {
  describe('create — valid inputs', () => {
    it('accepts a valid UUIDv4', () => {
      const result = TenantId.create(VALID_V4);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe(VALID_V4.toLowerCase());
    });

    it('accepts uppercase and normalizes to lowercase', () => {
      const result = TenantId.create(VALID_V4_UPPER);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe(VALID_V4.toLowerCase());
    });

    it('accepts a known valid UUIDv4 with variant nibble "8"', () => {
      const result = TenantId.create('f47ac10b-58cc-4372-8567-0e02b2c3d479');
      expect(result.ok).toBe(true);
    });

    it('accepts a known valid UUIDv4 with variant nibble "a"', () => {
      const result = TenantId.create('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result.ok).toBe(true);
    });
  });

  describe('create — invalid inputs', () => {
    it('rejects an empty string', () => {
      const result = TenantId.create('');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe('tenantId');
    });

    it('rejects a UUIDv1 (wrong version nibble)', () => {
      // Third group starts with '1' instead of '4'
      const result = TenantId.create('550e8400-e29b-11d4-a716-446655440000');
      expect(result.ok).toBe(false);
    });

    it('rejects a UUID with invalid variant nibble (not 8/9/a/b)', () => {
      // Fourth group starts with 'c' — not RFC 4122 variant
      const result = TenantId.create('550e8400-e29b-41d4-c716-446655440000');
      expect(result.ok).toBe(false);
    });

    it('rejects a UUID with missing hyphens', () => {
      const result = TenantId.create('550e8400e29b41d4a716446655440000');
      expect(result.ok).toBe(false);
    });

    it('rejects an arbitrary string', () => {
      const result = TenantId.create('not-a-uuid');
      expect(result.ok).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for equal UUIDs regardless of case', () => {
      const a = TenantId.create(VALID_V4);
      const b = TenantId.create(VALID_V4_UPPER);
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) expect(a.value.equals(b.value)).toBe(true);
    });

    it('returns false for different UUIDs', () => {
      const a = TenantId.create('550e8400-e29b-41d4-a716-446655440000');
      const b = TenantId.create('f47ac10b-58cc-4372-8567-0e02b2c3d479');
      if (a.ok && b.ok) expect(a.value.equals(b.value)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the lowercase UUID string', () => {
      const result = TenantId.create(VALID_V4_UPPER);
      if (result.ok) expect(result.value.toString()).toBe(VALID_V4.toLowerCase());
    });
  });
});
