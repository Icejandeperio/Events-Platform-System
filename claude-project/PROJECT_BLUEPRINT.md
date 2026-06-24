# TenantKit — Implementation Blueprint (Reference)

Condensed decision record and roadmap for planning conversations. The detailed
standards live in the repo `docs/`; this is the at-a-glance reference.

## Architecture in one screen

- **Modular monolith**, **Hexagonal** (ports & adapters). Core imports nothing
  external; adapters import the core; layering enforced by `dependency-cruiser`.
- **Next.js 15 (App Router) + TS strict** — UI + API in one deployable.
- **PostgreSQL + Drizzle**, multi-tenant via **RLS** (`tenant_id` on every tenant
  table; `withTenant()` sets `app.current_tenant`; `FORCE ROW LEVEL SECURITY`).
- **Auth.js** DB-backed sessions; **RBAC** (super-admin/tenant-admin/staff/
  participant); **entitlements** gate modules.
- **Ports:** `PaymentProvider` (Manual now → PayMongo later), `FileStorage`
  (local → Blob/R2), `Notifier`, repositories, `Clock`/`Id`. In-memory fakes for tests.
- Stateless app → local (Docker Compose) and serverless (Vercel + Neon pooled)
  differ only by config.

## Tenancy & access filtering ("what sees what")

- **Tenant isolation:** RLS (DB backstop) + application ownership checks (primary).
- **Role filtering:** function-level checks on every route; super-admin cross-tenant
  access is explicit and audited (never RLS-off).
- **Entitlement filtering:** `assertEntitled(tenant, module)` server-side guard;
  UI hides disabled modules cosmetically.
- **Anti-BOLA:** UUIDv4 IDs, ownership checks, two-tenant tests in CI.

## Payments path

Manual screenshot + verify (MVP) → PayMongo adapter behind the same port (cards/
GCash/Maya/bank, signed idempotent deduplicated webhooks, hosted redirect → PCI
SAQ-A). Provider stays swappable (Xendit for ASEAN later).

## Compliance must-haves before real users

DPO appointed · PIA done · NPC registration (or Sworn Declaration) · Privacy
Notice + recorded consent · DPAs with processors · 72-hour breach runbook ·
retention schedule · data-subject-rights tooling · audit logging · SAQ-A. Detail
in repo `docs/COMPLIANCE.md`.

## UI

shadcn/ui (Radix + Tailwind), Tremor/Recharts, Lucide. Mobile-first, WCAG 2.2 AA.
24 pages across public / registration / participant / staff-admin / super-admin /
auth. Full inventory in repo `docs/DESIGN.md`.

## Governance (anti-spaghetti)

Lean `CLAUDE.md` (+ `AGENTS.md` backup) → detailed `docs/` → `docs/adr/` decisions.
TSDoc on every export (lint-enforced). Conventional Commits + generated changelog
= the per-change "documentation report." Definition of Done gates every PR.
`dependency-cruiser` enforces the dependency rule. Keep context files minimal
(bloated agent context files measurably reduce success and raise cost).

## Staged roadmap

- **Stage 0 — Governance/scaffolding:** init repo with these markdown files,
  TS strict, ESLint + dependency-cruiser + complexity caps, Prettier, tsdoc lint,
  Husky/lint-staged, commitlint, release-please; write seed ADRs.
- **Stage 1 — Core MVP (local):** schema + RLS; hexagonal core (registration,
  participants, payments-manual, entitlements); Auth.js + RBAC; secure uploads;
  build the conversion path (register → pay-upload → staff verify); two-tenant tests.
- **Stage 2 — Compliance hardening:** PIA, consent, DPA workflows, breach runbook,
  DPO, NPC registration; ASVS L2 in CI; CSP on payment pages.
- **Stage 3 — Serverless migration (trigger: paying client):** Neon (pooled) +
  Vercel + Blob/R2; move secrets; deploy; Neon branches for previews.
- **Stage 4 — Real payments (trigger: client needs auto-collection):** PayMongo
  adapter behind the port; webhooks; no core change.

## Triggers that change the plan

>1M req/mo or bandwidth cost → evaluate Cloudflare Workers (OpenNext). · 250
employees / 1,000 sensitive-PII subjects → NPC registration legally mandatory. ·
ASEAN expansion / USD billing → reconsider Xendit/Stripe. · >100 divergent tenants
→ graduate entitlements to a flag service. · Hundreds of millions of rows →
partition by `tenant_id`.

## Caveats

Vendor pricing/free tiers and NPC thresholds/fees change — verify against official
sources before committing. RLS has edge cases (superuser migrations, SECURITY
DEFINER, replication) — test explicitly. PayMongo settles PHP only and has limited
native recurring billing. Auth library landscape is volatile (Lucia in
maintenance; Better Auth newer). Keep agent context files lean and revise them in
response to observed failures, not speculatively.
