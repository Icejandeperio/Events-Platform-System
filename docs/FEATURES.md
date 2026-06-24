# Features & Entitlements

What ships in the reusable **core** vs. what is sold as an optional **module**,
and how per-tenant access is controlled. The business model is: every partner
gets the core; they pay for the modules they need.

## 1. Core (every tenant gets this)

- **Tenancy & onboarding** — tenants, tenant settings, branding.
- **Users & RBAC** — `super_admin`, `tenant_admin`, `staff`, `participant`.
- **Events** — create/edit, pricing tiers, capacity, open/close.
- **Registration** — mobile-first flow, consent capture.
- **Participants** — records, table, detail, CSV export.
- **Payments (manual)** — instructions, proof upload, verification queue,
  status lifecycle. (Real gateway is a core capability behind the port; turning it
  on per tenant is an entitlement.)
- **Staff dashboard** — metrics, participant/payment tracking.
- **Compliance tooling** — privacy notice, consent records, data-subject requests, audit log.

## 2. Modules (optional, per-tenant, sold separately)

| Module key | What it adds | Pages |
|---|---|---|
| `gateway_payments` | Automated online payment via PayMongo (cards/GCash/Maya/bank) | replaces manual checkout |
| `checkin` | QR participant pass + marshal scan + check-in history | QR Pass, Marshal Scan, Check-ins History |
| `pwa_offline` | Installable PWA + offline check-in sync | Offline Sync Status |
| `geofence` | GPS validation / geofenced check-in | (extends `checkin`) |
| `totp_pass` | Rotating TOTP codes on participant passes | (extends `checkin`) |
| `advanced_analytics` | Cohorts, funnels, richer dashboards | extra dashboard tabs |
| `custom_fields` | Tenant-defined registration fields | extends registration |
| `messaging` | Email/SMS blasts to participants | Messaging page |

Module keys are stable strings; add new ones here first, then implement.

## 3. Entitlements model

**MVP-appropriate and intentionally simple — do not build a flag microservice
until 100+ tenants genuinely diverge.**

- A `tenant_entitlements` table: `tenant_id`, `module_key`, `enabled` (bool),
  optional `limits` (jsonb, e.g. `{ "max_events": 10 }`), `plan` (string).
- Entitlements are loaded with the tenant context and may be cached in the
  session/JWT for cheap reads — **but the server-side check is the security
  boundary** (a user must not unlock a module by editing client code).
- Distinguish **entitlement flags** (permanent, billing-linked) from short-lived
  **release flags** (used to roll out unfinished work). This file governs the former.

## 4. How to gate a module (the pattern)

1. **Domain/use case:** the module's use cases live in their own module folder; the
   core never imports them directly.
2. **Authorization:** an `assertEntitled(tenant, 'checkin')` guard at the start of
   every module use case and API route. Denied → 403, audit-logged.
3. **UI:** module pages/nav render only when the entitlement is on (cosmetic — the
   API guard is what actually protects it).
4. **Wiring:** the composition root registers module adapters only for tenants that
   have them; absence of a module must never break the core.
5. **Billing link:** enabling/disabling a module is a super-admin action on the
   Entitlements page and is connected to the tenant's plan.

## 5. Rules

- **Configuration over customization.** No tenant-specific `if (tenant === 'PAT')`
  branches in business logic — differences are entitlements/settings/data.
- A module is **self-contained**: removing its entitlement removes its behavior
  with zero effect on the core or other modules.
- New module = entry in this file + a key in `tenant_entitlements` + an ADR if it
  introduces a new architectural seam.
- Every module respects tenancy, RBAC, security, and compliance exactly as the
  core does — no exceptions for "add-on" code.
