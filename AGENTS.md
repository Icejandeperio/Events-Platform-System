# AGENTS.md — Cross-Tool Agent Instructions (Backup)

> **`CLAUDE.md` is authoritative.** This file exists so non-Claude tools
> (Codex, Cursor, Copilot, Gemini CLI, etc.) still get the essential rules.
> If the two ever disagree, follow `CLAUDE.md` and open an issue to resync.
> Keep this file a short mirror — do not let it drift into a second source of truth.

## Project

**TenantKit** — multi-tenant event registration + payment-management SaaS.
Reusable core (registration, participant/payment tracking, staff dashboard);
everything else is a per-tenant module gated by entitlements. First client:
Philippine Adventure Tour (PAT). Local-first now, serverless later.

## Stack

Next.js 16 (App Router) · TypeScript strict · PostgreSQL + Drizzle ORM ·
Postgres Row-Level Security for tenancy · Hexagonal architecture · Better Auth +
RBAC + entitlements. Local via Docker Compose; serverless target Vercel + Neon.

## Non-negotiable rules

1. Every DB query is tenant-scoped via `withTenant()`; RLS is the backstop.
2. Server-side authorization (tenant + role + ownership) on every endpoint. No client trust.
3. No card data on our servers — hosted-gateway redirect only (PCI SAQ-A).
4. UUIDv4 for all public IDs; never expose sequential integers.
5. Zod validation at every boundary; explicit input/output DTOs; no body-spreading into writes.
6. Dependency rule: core imports nothing external; adapters import core. Enforced by `dependency-cruiser`.
7. External services (payments, storage, email) live behind ports with in-memory fakes.
8. TSDoc on every exported symbol (lint-enforced).
9. Secrets only in env/secret store — never in repo, markdown, or client bundle.
10. One change = one Conventional Commit + the documentation loop (TSDoc, ADR if needed, docs page).

## Commands

```bash
npm run dev | db:up | db:migrate | db:seed | test | lint | typecheck | check
```

Run `npm run check` (lint + typecheck + test) before every commit.

## Detailed standards

See `docs/`: `ARCHITECTURE.md`, `SECURITY.md`, `COMPLIANCE.md`, `UIUX.md`,
`DESIGN.md`, `FEATURES.md`, `DOCUMENTATION.md`, `DEFINITION_OF_DONE.md`,
`GLOSSARY.md`, and `adr/`. Workflow in `CONTRIBUTING.md`.
