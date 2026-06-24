# TenantKit — Project Context (for the Claude Project knowledge folder)

> Put this file (and the others noted below) in **this Claude Project's knowledge
> folder** so Claude has shared context when we plan/strategize in chat. The dev
> repo has its own copies of the standards for Claude Code to follow while building.

## What we're building

**TenantKit** (working name) — a multi-tenant event registration and
payment-management SaaS. A reusable **core** (participant registration,
participant/payment tracking, staff dashboard) with optional **per-tenant
modules** (QR check-in, offline PWA, GPS, TOTP, gateway payments, analytics, etc.)
sold based on each business's needs. First client: **Philippine Adventure Tour
(PAT)**, but architected to serve any partner business.

## Business model

- Every partner gets the core.
- Modules are sold per business via per-tenant **entitlements**.
- Differences between tenants are **configuration/data, never forked code**.

## Hard constraints / decisions already made

- **Local-first now** (no funds), clean migration to **serverless** (Vercel +
  Neon, Cloudflare later) when a paying client is signed.
- **Payments:** manual screenshot + staff verification for the MVP, behind a
  `PaymentProvider` port so **PayMongo** drops in later with no core change.
- **Multi-tenant from day one**, isolated by Postgres **Row-Level Security**; each
  tenant sees only their own data; access filtered by **role** (super-admin /
  tenant-admin / staff / participant) and **entitlement**.
- **Stack:** Next.js 15 + TypeScript (strict), Drizzle ORM + PostgreSQL,
  Hexagonal architecture, Auth.js, shadcn/ui.
- **Compliance is a launch requirement:** Philippine Data Privacy Act (RA 10173),
  GDPR-aligned, OWASP ASVS L2, PCI SAQ-A (no card data on our servers).
- **Resource efficiency** is a first-class goal — lean deps, low cold starts,
  scale-to-zero DB.

## How development runs

Claude Code builds the system in the repo, following `CLAUDE.md` (lean rules) +
`docs/` (detailed standards) + `docs/adr/` (decisions). Every change follows the
documentation loop: TSDoc + Conventional Commit + ADR-if-architectural + docs
update. Definition of Done gates every PR.

## What I value from Claude in this project

Direct analysis over validation; flag weak assumptions and propose the stronger
option; first-principles reasoning; structured, scannable output; no filler. When
something I ask for is a mistake, say so and explain why.

## Open items to discuss next (after preliminary research)

- Confirm platform name (TenantKit vs Convene vs Gateway, or your own).
- DPO appointment and NPC registration timing.
- Which modules PAT actually needs for its first event.
- Hosting accounts and budget thresholds that trigger the serverless move.

## Files to keep in this Project folder

- `PROJECT_CONTEXT.md` (this file)
- `PROJECT_BLUEPRINT.md` (the full research/architecture blueprint)
- Copies of `ARCHITECTURE.md`, `SECURITY.md`, `COMPLIANCE.md`, `DESIGN.md`,
  `FEATURES.md` for conversational context (the authoritative copies live in the repo).
