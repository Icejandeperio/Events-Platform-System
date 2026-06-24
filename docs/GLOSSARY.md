# Glossary

Canonical domain vocabulary. Use these exact terms in code, comments, commits,
and docs. Consistent naming is the cheapest defense against an AI agent inventing
three names for the same concept.

| Term | Definition |
|---|---|
| **Tenant** | A partner business using the platform (e.g., Philippine Adventure Tour). The unit of data isolation. Every tenant-owned row has `tenant_id`. |
| **Platform / Super-admin** | The owner of TenantKit itself; can manage tenants and entitlements across the system via explicit, audited paths. |
| **Tenant-admin** | A partner business owner/manager; full control within their own tenant only. |
| **Staff / Marshal** | A tenant's operational user; handles registrations, payment verification, check-in. "Marshal" is the event-day role for the check-in module. |
| **Participant** | An end customer who registers for an event. May have a login (participant role). |
| **Event** | A schedulable offering a participant registers for; has pricing tiers and capacity. |
| **Registration** | The act/record of a participant signing up for an event. |
| **Payment** | A record of money owed/paid for a registration. Status lifecycle: `PENDING → SUBMITTED → CONFIRMED \| REJECTED`; a `REJECTED` payment returns to `SUBMITTED` when the participant re-uploads proof. Stored as integer minor units (centavos). |
| **Proof of payment** | The screenshot/file a participant uploads in the manual flow. Personal data; protected like all PII. |
| **Manual payment flow** | MVP method: participant pays out-of-band, uploads proof, staff verifies. |
| **Gateway payment** | Module method: automated online payment via PayMongo behind the `PaymentProvider` port. |
| **Entitlement** | A per-tenant flag (with optional limits) granting access to a module. Billing-linked, permanent. |
| **Module** | An optional, self-contained feature sold per tenant (e.g., `checkin`, `pwa_offline`). |
| **Core** | The non-optional capabilities every tenant receives. |
| **Port** | An interface the core defines for something it needs (`PaymentProviderPort`, `FileStoragePort`). |
| **Adapter** | A concrete implementation of a port (`ManualScreenshotAdapter`, `PayMongoAdapter`). |
| **`withTenant()`** | The request-scoped wrapper that opens a transaction and sets the RLS tenant context. |
| **RLS** | Postgres Row-Level Security; the database-layer tenant isolation backstop. |
| **Entity / Value Object** | Domain building blocks. Entities have identity; value objects (Email, Phone, Money) are immutable and compared by value. |
| **Use case** | One application operation orchestrating the domain (`RegisterForEvent`, `VerifyPayment`). The authorization boundary. |
| **DTO** | Zod-validated data shape crossing a boundary (input or output). |
| **Audit log** | Append-only, tenant-tagged record of sensitive actions. |

Add a term here the first time you introduce a concept; never introduce a synonym
for an existing term.
