# Architecture & Organization

How the codebase is structured, how the layers depend on each other, and how
multi-tenancy is enforced. This is the map. When in doubt about where code goes,
this file decides.

## 1. Principles

1. **Hexagonal (Ports & Adapters).** The business core is isolated from
   frameworks, the database, HTTP, and third-party SDKs. Those are details
   plugged in at the edges.
2. **The Dependency Rule.** Source-code dependencies point inward only. The core
   knows nothing about Next.js, Drizzle, Postgres, Auth.js, or PayMongo.
3. **Modular monolith.** One deployable app, internally split into modules with
   clear boundaries. We do not start with microservices.
4. **Configuration over customization.** Per-tenant differences are data
   (entitlements, settings), not forked code.
5. **Tenant isolation is enforced at two layers** — application (primary) and
   database RLS (backstop). Never rely on a single layer.

## 2. Layers

```
┌───────────────────────────────────────────────────────────────┐
│ interfaces/  (driving adapters)                                │
│   Next.js route handlers, server actions, React pages/components│
│   — translate HTTP/UI <-> use-case calls. Thin. No business logic.│
├───────────────────────────────────────────────────────────────┤
│ application/ (use cases + ports)                               │
│   Orchestrates domain to fulfill one operation. Defines PORTS  │
│   (interfaces) it needs. The authorization boundary lives here.│
├───────────────────────────────────────────────────────────────┤
│ domain/      (entities, value objects, domain services)        │
│   Pure business rules and invariants. Zero external imports.   │
├───────────────────────────────────────────────────────────────┤
│ infrastructure/ (driven adapters)                              │
│   Implements ports: Drizzle repositories, PaymentProvider      │
│   adapters, FileStorage, Notifier, Auth. Imports the core.     │
└───────────────────────────────────────────────────────────────┘
```

**Allowed imports (enforced by `dependency-cruiser`):**

- `domain/` → imports nothing outside `domain/`.
- `application/` → may import `domain/` and its own ports. **Not** infrastructure or interfaces.
- `infrastructure/` → may import `domain/` and `application/` ports. Implements them.
- `interfaces/` → may import `application/` use cases (and `domain/` types). **Not** infrastructure directly.
- Wiring (dependency injection) happens only in a composition root (`app/_bootstrap`).

A violation fails CI. Do not work around it — if you need a new dependency
direction, that is an ADR-worthy decision.

## 3. Directory layout

```
src/
  domain/
    <module>/
      entities/            # ParticipantEntity, PaymentEntity, EventEntity, ...
      value-objects/       # Email, PhoneNumber, Money, TenantId, ...
      services/            # pure domain logic spanning entities
  application/
    <module>/
      usecases/            # RegisterForEvent, CreateManualPayment, VerifyPayment, ...
      ports/               # PaymentProviderPort, ParticipantRepositoryPort, FileStoragePort, ...
      dto/                 # Zod-validated input/output shapes
  infrastructure/
    db/                    # Drizzle schema, repositories, withTenant(), RLS helpers
    payments/              # ManualScreenshotAdapter, (later) PayMongoAdapter
    storage/               # BlobStorageAdapter (Vercel Blob / R2 / local disk)
    auth/                  # Auth.js config, session, RBAC helpers
    notify/                # EmailAdapter, SmsAdapter
  interfaces/
    api/                   # Next.js route handlers (/api/...)
    actions/               # server actions
    web/                   # React pages, layouts, components (shadcn/ui)
  shared/                  # cross-cutting: Result type, errors, logger, config, zod helpers
  app/_bootstrap/          # composition root: build use cases, inject adapters
docs/                      # all standards + ADRs
```

One folder per **module** inside `domain/` and `application/`. Modules: `core`
(tenancy, participants, registration, payments, events, users) and feature
modules (`checkin`, `pwa`, `geofence`, ... — see `docs/FEATURES.md`).

## 4. Multi-tenancy (the most important rule)

**Model:** shared database, shared schema, **Row-Level Security (RLS)**. Every
tenant-owned table has a `tenant_id uuid not null` column.

**Request flow:**
1. Auth resolves the user and their `tenant_id` (from session / org claim).
2. A request-scoped wrapper opens a DB transaction and sets the tenant context:
   `SET LOCAL app.current_tenant = <tenant_id>`.
3. All queries in that transaction run under RLS policies that filter by
   `app.current_tenant`. A missing `WHERE tenant_id` cannot leak data.

**RLS setup (every tenant table):**
```sql
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants FORCE ROW LEVEL SECURITY;          -- applies even to table owner
CREATE POLICY tenant_isolation ON participants
  USING (tenant_id = current_setting('app.current_tenant')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

**Hard requirements:**
- The application connects as a role that is **not** the table owner and does
  **not** have `BYPASSRLS`.
- Cross-tenant operations (super-admin, support impersonation) use a separate,
  explicit, audited code path — never by turning RLS off.
- Migrations run as a privileged role; verify policies after every migration.
- Every new data-access path ships with a **two-tenant test** proving tenant A
  cannot read or write tenant B's rows. (See `docs/SECURITY.md`.)

See `docs/adr/0001-multi-tenancy-row-level-security.md` for the rationale and
alternatives considered.

## 5. Ports we standardize on

| Port | Purpose | MVP adapter | Later adapter |
|---|---|---|---|
| `PaymentProviderPort` | initiate/confirm payment | `ManualScreenshotAdapter` | `PayMongoAdapter` |
| `FileStoragePort` | store proof-of-payment, assets | `LocalDiskAdapter` | `BlobStorageAdapter` (Vercel Blob / R2) |
| `NotifierPort` | email/SMS | `ConsoleNotifier` (dev) | `EmailAdapter`, `SmsAdapter` |
| `*RepositoryPort` | persistence per aggregate | Drizzle repositories (RLS-scoped) | same |
| `ClockPort`, `IdPort` | time + UUIDs (testable) | system adapters | same |

Every port has an **in-memory fake** in `infrastructure/<x>/fakes/` used by tests
so the core is testable without a database or network.

## 6. State & serverless readiness

- The app is **stateless**: no in-process caches of tenant data, no in-memory
  sessions. Session state lives in Postgres; request state lives in the request.
- This is what makes the local→serverless move a config change, not a rewrite.
- For serverless Postgres, connect through a **pooled** endpoint (Neon pooler /
  PgBouncer). Never open a raw connection per invocation.

## 7. Error handling & results

- Use a `Result<T, E>` (or typed exceptions) at use-case boundaries; never let
  raw infrastructure errors leak to `interfaces/`.
- `interfaces/` maps domain errors to HTTP status codes in one place.
- Never return stack traces or internal messages to clients in production.

## 8. When you add a feature

1. Does it belong in the **core** or a **module**? (See `docs/FEATURES.md`.)
2. Define/extend the **domain** first, then the **use case + ports**, then the
   **adapter**, then the **interface**. Inward-out.
3. Add the entitlement flag if it is a module.
4. Write tests (incl. cross-tenant). Update docs. Add an ADR if you made a
   structural decision.
