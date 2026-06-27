import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { ValidationError } from '@shared/errors';

/**
 * Monetary amount value object — an integer count of Philippine centavos.
 *
 * @remarks
 * All monetary values in TenantKit are integer centavos (₱1 = 100 centavos)
 * to avoid floating-point rounding errors (SECURITY.md §8, GLOSSARY).
 * The domain `Money` VO enforces this at the domain boundary; `MoneySchema`
 * in `@shared/zod` enforces it at the HTTP boundary.
 * Two `Money` instances are equal when their centavo amounts are identical.
 */
export class Money {
  private constructor(
    /** The amount in integer centavos (≥ 0). */
    readonly centavos: number,
  ) {}

  /**
   * Validates and constructs a `Money` value object.
   *
   * @param centavos - The amount in centavos; must be a non-negative integer.
   * @returns `ok(Money)` when valid, or `err(ValidationError)` for decimals or negatives.
   */
  static create(centavos: number): Result<Money, ValidationError> {
    if (!Number.isInteger(centavos)) {
      return err(
        new ValidationError(
          'Monetary amount must be an integer number of centavos (no decimals).',
          'amount',
        ),
      );
    }
    if (centavos < 0) {
      return err(new ValidationError('Monetary amount must be ≥ 0.', 'amount'));
    }
    return ok(new Money(centavos));
  }

  /**
   * Returns a new `Money` that is the sum of this value and `other`.
   *
   * @param other - The amount to add.
   * @returns A new `Money` instance with the combined centavo amount.
   */
  add(other: Money): Money {
    return new Money(this.centavos + other.centavos);
  }

  /**
   * Returns `true` when both amounts represent the same centavo value.
   *
   * @param other - The `Money` to compare against.
   * @returns `true` if the centavo amounts are identical.
   */
  equals(other: Money): boolean {
    return this.centavos === other.centavos;
  }

  /**
   * Returns a human-readable peso string, e.g. `"₱10.50"`.
   *
   * @returns The formatted peso string.
   */
  toString(): string {
    return `₱${(this.centavos / 100).toFixed(2)}`;
  }
}
