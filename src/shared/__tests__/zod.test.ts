import { describe, it, expect } from 'vitest';
import { UuidSchema, MoneySchema } from '../zod';

describe('UuidSchema', () => {
  it('accepts a valid v4 UUID', () => {
    expect(() => UuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
  });

  it('rejects a plain string', () => {
    expect(() => UuidSchema.parse('not-a-uuid')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => UuidSchema.parse('')).toThrow();
  });

  it('rejects a numeric sequential id', () => {
    expect(() => UuidSchema.parse('12345')).toThrow();
  });
});

describe('MoneySchema', () => {
  it('accepts zero', () => {
    expect(MoneySchema.parse(0)).toBe(0);
  });

  it('accepts a positive integer centavo amount', () => {
    expect(MoneySchema.parse(1000)).toBe(1000);
  });

  it('rejects decimals', () => {
    expect(() => MoneySchema.parse(10.5)).toThrow();
  });

  it('rejects negative amounts', () => {
    expect(() => MoneySchema.parse(-1)).toThrow();
  });

  it('rejects strings', () => {
    expect(() => MoneySchema.parse('1000')).toThrow();
  });
});
