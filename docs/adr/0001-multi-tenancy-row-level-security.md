# 0001. Multi-tenancy via Postgres Row-Level Security

- Status: Accepted
- Date: 2026-06-24
- Deciders: Founder/Operator, Lead Engineer

## Context

The platform is multi-tenant from day one: many partner businesses share one
system and must never see each other's data. A single forgotten `WHERE
tenant_id` clause must not be able to leak data across tenants. The system starts
on local Postgres and migrates to serverless Postgres (Neon) later. We need an
isolation model that is secure, cheap to operate, and scales to many tenants.

## Decision

Use a **shared database, shared schema** model with **PostgreSQL Row-Level
Security (RLS)** as the enforced isolation layer. Every tenant-owned table has a
`tenant_id uuid not null`. Each request runs inside a transaction that sets
`app.current_tenant`; RLS policies (`USING`/`WITH CHECK`, with `FORCE ROW LEVEL
SECURITY`) filter every read and write. The application connects as a role that
is neither the table owner nor `BYPASSRLS`. Application-layer ownership checks
remain the primary authorization boundary; RLS is the backstop.

## Alternatives considered

- **Database-per-tenant** — strongest isolation but high cost/ops overhead and
  painful migrations across hundreds of tenants; rejected for an MVP.
- **Schema-per-tenant** — catalog bloat past a few hundred tenants, no real
  security gain over RLS, complex migrations; rejected.
- **App-only filtering (no RLS)** — one missed clause leaks data; rejected as the
  sole mechanism. We keep app-layer checks but add RLS underneath.

## Consequences

- Strong, database-enforced isolation with low operational cost; easy to back up
  and migrate as one database.
- Requires discipline: correct DB role/privileges, `FORCE RLS`, tenant context
  set per request via `withTenant()`, and explicit audited paths for legitimate
  cross-tenant operations (super-admin, support).
- Every new data-access path must ship with a two-tenant test.
- Known edge cases to watch: migrations as a superuser, `SECURITY DEFINER`
  functions, and replication can bypass policies — verify after migrations.
