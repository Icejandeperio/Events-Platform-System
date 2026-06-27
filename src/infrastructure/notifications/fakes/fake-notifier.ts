import { ok } from '@shared/result';
import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type {
  EmailMessage,
  NotifierPort,
  SmsMessage,
} from '@application/notifications/ports/notifier.port';

/**
 * In-memory fake implementation of `NotifierPort` for unit tests.
 *
 * @remarks
 * All messages are captured in-memory rather than delivered. Inspect
 * `sentEmails` and `sentSms` in test assertions to verify the correct
 * notifications were triggered. Call `reset()` in `beforeEach` to clear state.
 */
export class FakeNotifier implements NotifierPort {
  /** All email messages sent since construction or the last `reset()` call. */
  readonly sentEmails: EmailMessage[] = [];

  /** All SMS messages sent since construction or the last `reset()` call. */
  readonly sentSms: SmsMessage[] = [];

  /**
   * Captures an email message without delivering it.
   *
   * @param message - The email to capture.
   * @returns `ok(void)` always.
   */
  async sendEmail(message: EmailMessage): Promise<Result<void, DomainError>> {
    this.sentEmails.push(message);
    return ok(undefined);
  }

  /**
   * Captures an SMS message without delivering it.
   *
   * @param message - The SMS to capture.
   * @returns `ok(void)` always.
   */
  async sendSms(message: SmsMessage): Promise<Result<void, DomainError>> {
    this.sentSms.push(message);
    return ok(undefined);
  }

  /** Clears all captured messages. Call in `beforeEach` to reset state between tests. */
  reset(): void {
    this.sentEmails.length = 0;
    this.sentSms.length = 0;
  }
}
