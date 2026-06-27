import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { DomainError } from '@shared/errors';
import type {
  CheckoutParams,
  PaymentProviderPort,
  WebhookEvent,
} from '@application/payment-provider/ports/payment-provider.port';

/**
 * In-memory fake implementation of `PaymentProviderPort` for unit tests.
 *
 * @remarks
 * `createCheckoutUrl` records the params and returns a deterministic fake URL.
 * `verifyWebhook` returns a pre-programmed `WebhookEvent` set via `queueWebhookEvent()`;
 * call `queueWebhookEvent()` before triggering any code path that calls `verifyWebhook`.
 * Inspect `capturedCheckouts` and `capturedWebhookCalls` in test assertions.
 */
export class FakePaymentProvider implements PaymentProviderPort {
  /** Ordered list of all `createCheckoutUrl` calls received. */
  readonly capturedCheckouts: CheckoutParams[] = [];

  /** Number of `verifyWebhook` calls received. */
  private webhookCallCount = 0;
  private readonly webhookQueue: WebhookEvent[] = [];

  /**
   * Pre-programs the next `WebhookEvent` that `verifyWebhook` will return.
   *
   * @param event - The event to return on the next `verifyWebhook` call.
   */
  queueWebhookEvent(event: WebhookEvent): void {
    this.webhookQueue.push(event);
  }

  /** Total number of `verifyWebhook` calls received since construction or `reset()`. */
  get webhookCallsReceived(): number {
    return this.webhookCallCount;
  }

  /**
   * Records the checkout params and returns a deterministic fake checkout URL.
   *
   * @param params - The checkout parameters to record.
   * @returns A fake checkout URL embedding the `registrationId`.
   */
  async createCheckoutUrl(params: CheckoutParams): Promise<Result<string, DomainError>> {
    this.capturedCheckouts.push(params);
    return ok(`https://fake-gateway.test/pay/${params.registrationId}`);
  }

  /**
   * Returns the next queued `WebhookEvent` or a `DomainError` if the queue is empty.
   *
   * @param _payload - Raw webhook body (ignored in fake; use `queueWebhookEvent` instead).
   * @param _signature - Webhook signature header (not verified in fake).
   * @returns The next queued event, or `DomainError` when no event has been queued.
   */
  verifyWebhook(_payload: string, _signature: string): Result<WebhookEvent, DomainError> {
    this.webhookCallCount += 1;
    const event = this.webhookQueue.shift();
    if (!event) {
      return err(
        new DomainError(
          'FakePaymentProvider: no webhook event queued — call queueWebhookEvent() first',
        ),
      );
    }
    return ok(event);
  }

  /** Resets all captured state and the event queue. Call in `beforeEach`. */
  reset(): void {
    this.capturedCheckouts.length = 0;
    this.webhookQueue.length = 0;
    this.webhookCallCount = 0;
  }
}
