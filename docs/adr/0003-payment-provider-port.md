# 0003. Payments behind a PaymentProvider port

- Status: Accepted
- Date: 2026-06-24
- Deciders: Founder/Operator, Lead Engineer

## Context

The MVP cannot fund or prioritize a live payment gateway yet, so payment is
manual: the participant pays out-of-band (GCash/Maya/bank), uploads a screenshot,
and staff verify it. But we want real automated payments (PayMongo) to be a
plug-and-play upgrade later, with no rewrite of the core, and we must keep PCI
scope minimal.

## Decision

Define a single **`PaymentProviderPort`** in the application layer expressing what
the business needs ("initiate a payment for a registration", "get/confirm
status"), shaped around the domain rather than any vendor SDK. Ship a
**`ManualScreenshotAdapter`** now (creates a PENDING payment, stores proof via
`FileStoragePort`, exposes it to the staff verification queue). Later add a
**`PayMongoAdapter`** implementing the same port (Payment Intent flow, idempotency
keys, signed webhook handling, status mapping). Card data never touches our
servers — hosted-gateway redirect only — keeping us at PCI **SAQ-A**. Whether a
tenant uses the gateway is an **entitlement** (`gateway_payments`).

## Alternatives considered

- **Hardcode the manual flow now, integrate PayMongo later by editing call sites**
  — guarantees rework and scattered payment logic; rejected.
- **Integrate PayMongo immediately** — no budget/need yet; adds compliance and
  webhook surface prematurely; rejected for MVP.
- **Couple to the PayMongo SDK shape** — would leak vendor concepts into the core
  and make swapping providers (e.g., Xendit for ASEAN) costly; rejected.

## Consequences

- Swapping manual → gateway is a new adapter + wiring change, not a core change.
- A fake in-memory payment adapter enables deterministic tests with no network.
- Webhook handling (when added) must verify signatures, return 200 immediately,
  process async, and deduplicate by event ID; the webhook — not the browser
  redirect — is the source of truth.
- Provider portability preserved (PayMongo now; Xendit/others later) at low cost.
