import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';
import type { Money } from '@domain/value-objects/money';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * Parameters for initiating a hosted-gateway checkout session.
 *
 * @remarks
 * TenantKit uses the hosted-redirect model (PCI SAQ-A): card data never
 * touches our servers. The gateway redirects the user back to `successUrl`
 * or `cancelUrl` after payment (SECURITY.md §3, golden rule 3).
 */
export interface CheckoutParams {
  /** The tenant initiating the payment. */
  readonly tenantId: TenantId;
  /** The registration this payment is for. */
  readonly registrationId: string;
  /** Amount to charge, in integer centavos. */
  readonly amount: Money;
  /** Short description shown on the payment page. */
  readonly description: string;
  /** URL the gateway redirects to on successful payment. */
  readonly successUrl: string;
  /** URL the gateway redirects to when the user cancels. */
  readonly cancelUrl: string;
}

/** Discriminated union of webhook event types emitted by the payment gateway. */
export type WebhookEventType = 'payment.paid' | 'payment.failed' | 'payment.refunded';

/**
 * A verified, parsed webhook event from the payment gateway.
 *
 * @remarks
 * Only returned after `verifyWebhook()` confirms the signature — callers should
 * never construct this type directly from raw webhook payloads.
 */
export interface WebhookEvent {
  /** The type of event. */
  readonly type: WebhookEventType;
  /** The gateway's own reference for this transaction. */
  readonly externalId: string;
  /** Our registration ID, echoed back by the gateway. */
  readonly registrationId: string;
  /** Amount confirmed or refunded, in integer centavos. */
  readonly amount: Money;
}

/**
 * Driven port — payment gateway adapter (hosted-redirect model).
 *
 * @remarks
 * Card data never crosses our servers (PCI SAQ-A compliance, golden rule 3).
 * `FakePaymentProvider` is used in tests; `PayMongoAdapter` (or similar) in
 * production.
 */
export interface PaymentProviderPort {
  /**
   * Requests a hosted checkout URL from the gateway.
   *
   * @param params - Checkout parameters including amount and redirect URLs.
   * @returns The one-time checkout URL to redirect the user to, or a `DomainError`.
   */
  createCheckoutUrl(params: CheckoutParams): Promise<Result<string, DomainError>>;

  /**
   * Verifies a raw webhook payload and extracts the typed event.
   *
   * @param payload - The raw request body string received from the gateway.
   * @param signature - The gateway-provided HMAC or JWT signature header.
   * @returns A verified `WebhookEvent`, or `DomainError` on invalid signature or parse failure.
   */
  verifyWebhook(payload: string, signature: string): Result<WebhookEvent, DomainError>;
}
