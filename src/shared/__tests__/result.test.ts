import { describe, it, expect } from 'vitest';
import { ok, err } from '../result';

describe('Result', () => {
  it('ok() produces a success variant', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err() produces a failure variant', () => {
    const r = err(new Error('oops'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe('oops');
  });

  it('ok() and err() are discriminated by the ok flag', () => {
    const results = [ok('a'), err('b')] as const;
    const [success, failure] = results;
    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
  });
});
