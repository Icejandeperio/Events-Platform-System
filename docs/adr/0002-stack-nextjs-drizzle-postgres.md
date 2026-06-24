# 0002. Stack: Next.js 16 + Drizzle ORM + PostgreSQL

- Status: Accepted (amended 2026-06-24 — Next.js 16.x; auth superseded by ADR 0004)
- Date: 2026-06-24
- Deciders: Founder/Operator, Lead Engineer

## Context

We need one codebase for a mobile-first registration UI and an API, that runs
cheaply on local hardware now and migrates to serverless with minimal rework and
fast cold starts. We are cost- and resource-constrained, multi-tenant with RLS,
and want a stack any engineer can read.

## Decision

- **Next.js 16 (App Router) + TypeScript (strict)** for UI and API in one
  deployable, with a first-class Vercel path.
- **PostgreSQL + Drizzle ORM.** Drizzle's SQL-first model lets us set the RLS
  session variable per request and keeps a tiny (~7 KB, zero-dependency) runtime
  that minimizes serverless cold starts. No paid add-on dependency.
- **Hexagonal architecture** so frameworks/DB/SDKs stay at the edges.
- **Better Auth** (DB-backed sessions) for revocable auth without per-MAU cost.
  See ADR 0004 for the full auth decision and tenant/super-admin mapping.
- Local via **Docker Compose**; serverless target **Vercel + Neon** (pooled
  connection), file storage **Vercel Blob / R2**.

## Alternatives considered

- **Separate NestJS backend + React frontend** — cleaner service boundary but
  doubles deploy/ops surface; unjustified for an MVP. Hexagonal + Next.js gives
  the same separation of concerns internally.
- **Prisma ORM** — excellent schema-first DX and auto-migrations, but a larger
  runtime/cold-start cost and historically awkward RLS ergonomics. Reconsider if
  the team strongly prefers its DX.
- **Clerk for auth** — great DX but per-MAU pricing and hosted lock-in conflict
  with cost/data-control goals. **Lucia** is in maintenance mode — not adopted.
  **Auth.js v5** — considered but superseded; see ADR 0004.

## Consequences

- One lean deployable; local→serverless is a config change (stateless app,
  standard Postgres + S3-compatible storage), not a rewrite.
- Drizzle's lower-level nature means we write more explicit SQL/queries — good for
  RLS control, slightly more verbose than Prisma.
- Must use a pooled Postgres endpoint on serverless to avoid connection exhaustion.
- Cloudflare Workers remains a future cost-optimization target; keeping the app
  portable preserves that option (would need the OpenNext adapter).
