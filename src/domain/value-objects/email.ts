import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { ValidationError } from '@shared/errors';

// Minimal RFC-5322-inspired check: non-whitespace @ non-whitespace . non-whitespace.
// Intentionally permissive — strict RFC compliance is left to the email provider.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email value object — a normalized, validated email address.
 *
 * @remarks
 * Constructed only via `Email.create()`. The stored value is always lowercase
 * and trimmed. Two `Email` instances are equal when their values are identical.
 */
export class Email {
  private constructor(
    /** The normalized email address string (lowercase, trimmed). */
    readonly value: string,
  ) {}

  /**
   * Validates and constructs an `Email` from a raw string.
   *
   * @param raw - The raw email string; whitespace is stripped and the result lowercased.
   * @returns `ok(Email)` when the address is syntactically valid, or `err(ValidationError)`.
   */
  static create(raw: string): Result<Email, ValidationError> {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      return err(new ValidationError(`Invalid email address: "${raw}"`, 'email'));
    }
    return ok(new Email(normalized));
  }

  /**
   * Returns `true` when both emails represent the same normalized address.
   *
   * @param other - The `Email` to compare against.
   * @returns `true` if the addresses are identical after normalization.
   */
  equals(other: Email): boolean {
    return this.value === other.value;
  }

  /**
   * Returns the normalized email address string.
   *
   * @returns The email address value.
   */
  toString(): string {
    return this.value;
  }
}
