import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { ValidationError } from '@shared/errors';

// Accepts Philippine mobile numbers only:
//   Local format  — 09XXXXXXXXX (11 digits, starts with 09)
//   E.164 format  — +639XXXXXXXXX (starts with +639)
// Other separators (spaces, dashes) are stripped before matching.
const PH_MOBILE_RE = /^(\+639|09)\d{9}$/;

/**
 * Philippine mobile phone number value object.
 *
 * @remarks
 * Accepts local format (`09XXXXXXXXX`) and E.164 format (`+639XXXXXXXXX`).
 * The stored value is always E.164 (`+639...`). Formatting characters such as
 * spaces and dashes are stripped before validation.
 * Two `PhoneNumber` instances are equal when their normalized values match.
 */
export class PhoneNumber {
  private constructor(
    /** The normalized E.164 value, e.g. `"+639171234567"`. */
    readonly value: string,
  ) {}

  /**
   * Validates and constructs a `PhoneNumber` from a raw string.
   *
   * @param raw - The raw phone string; spaces, dashes, and parentheses are stripped first.
   * @returns `ok(PhoneNumber)` normalized to E.164, or `err(ValidationError)`.
   */
  static create(raw: string): Result<PhoneNumber, ValidationError> {
    const stripped = raw.replace(/[\s\-(). ]/g, '');
    if (!PH_MOBILE_RE.test(stripped)) {
      return err(
        new ValidationError(
          `Invalid Philippine mobile number: "${raw}". Expected format: 09XXXXXXXXX or +639XXXXXXXXX.`,
          'phone',
        ),
      );
    }
    // Normalize local 09... prefix to E.164 +639...
    const normalized = stripped.startsWith('0') ? `+63${stripped.slice(1)}` : stripped;
    return ok(new PhoneNumber(normalized));
  }

  /**
   * Returns `true` when both phone numbers share the same normalized E.164 value.
   *
   * @param other - The `PhoneNumber` to compare against.
   * @returns `true` if the numbers are identical after normalization.
   */
  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  /**
   * Returns the normalized E.164 phone number string.
   *
   * @returns The E.164 phone number value.
   */
  toString(): string {
    return this.value;
  }
}
