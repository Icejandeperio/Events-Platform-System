import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type { Email } from '@domain/value-objects/email';
import type { PhoneNumber } from '@domain/value-objects/phone-number';

/**
 * An outbound email notification to be delivered to a participant or staff member.
 *
 * @remarks
 * The `html` field is optional; plain-text `text` is always required as a fallback.
 * Never include raw PII beyond what is strictly necessary for the notification
 * (COMPLIANCE.md §data-minimization).
 */
export interface EmailMessage {
  /** Validated recipient email address. */
  readonly to: Email;
  /** Email subject line. */
  readonly subject: string;
  /** Plain-text body (required; used when the client does not render HTML). */
  readonly text: string;
  /** Optional HTML body. */
  readonly html?: string;
}

/**
 * An outbound SMS notification to be delivered to a participant's phone.
 *
 * @remarks
 * SMS bodies must be concise (≤ 160 characters per segment to avoid multi-part
 * billing). Never include sensitive data like payment references in plaintext SMS.
 */
export interface SmsMessage {
  /** Validated recipient phone number in E.164 format. */
  readonly to: PhoneNumber;
  /** The SMS body text. */
  readonly body: string;
}

/**
 * Driven port — outbound email and SMS notifications.
 *
 * @remarks
 * `FakeNotifier` is used in tests (captures sent messages for assertions).
 * Production adapters (e.g. Resend for email, Twilio for SMS) are wired in the
 * composition root and toggled per-tenant via entitlements (FEATURES.md).
 */
export interface NotifierPort {
  /**
   * Sends an email message.
   *
   * @param message - The email to deliver.
   * @returns `ok(void)` on acceptance by the provider, or `DomainError` on failure.
   */
  sendEmail(message: EmailMessage): Promise<Result<void, DomainError>>;

  /**
   * Sends an SMS message.
   *
   * @param message - The SMS to deliver.
   * @returns `ok(void)` on acceptance by the provider, or `DomainError` on failure.
   */
  sendSms(message: SmsMessage): Promise<Result<void, DomainError>>;
}
