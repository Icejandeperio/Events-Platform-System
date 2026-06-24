# CLAUDE.md — Agent Operating Manual (Authoritative)

> This is the primary instruction file for Claude Code. `AGENTS.md` mirrors the
> essentials for other tools but **this file wins** on any conflict. Keep it
> short. Detailed standards live in `docs/` and are loaded only when relevant.

## What this project is

**TenantKit** — a multi-tenant event registration and payment-management SaaS.
The reusable **core** handles participant registration, participant/payment
tracking, and a staff dashboard. Everything else (QR check-in, offline PWA, GPS,
TOTP, etc.) is an **optional module** toggled per tenant via entitlements.
First client: Philippine Adventure Tour (PAT). Built local-first, migrates to
serverless when a paying client is signed.

## Stack (do not deviate without an ADR)

- **Next.js 16 (App Router) + TypeScript (strict)** — UI and API in one codebase
- **PostgreSQL + Drizzle ORM** — multi-tenant via Row-Level Security (RLS)
- **Hexagonal architecture** — domain core depends on nothing external; adapters depend on the core
- **Better Auth** (sessions, DB-backed) + RBAC + per-tenant entitlements (see ADR 0004)
- Local: Docker Compose. Serverless target: Vercel + Neon (pooled). Storage: Vercel Blob / R2.

## The 10 golden rules (never violate)

1. **Every query is tenant-scoped.** Use the `withTenant()` wrapper which sets
   the RLS session variable. RLS is the backstop; the use-case layer is the
   primary authorization boundary. Never write a raw query without tenant scope.
2. **Server-side authorization on every endpoint.** Check tenant AND role AND
   object ownership for every request. Never trust the client. (See `docs/SECURITY.md` → BOLA.)
3. **No card data ever touches our servers.** Payments go through hosted-gateway
   redirect only. This keeps us at PCI SAQ-A. Card PANs in our DB = critical incident.
4. **Use UUIDv4 for all public IDs.** Never expose sequential integer IDs.
5. **Validate every boundary with Zod.** Explicit input AND output DTOs. Never
   spread a request body into a DB write. Never return a whole row.
6. **The dependency rule is physical, not aspirational.** Core imports no
   framework/DB/HTTP. Adapters import the core. `dependency-cruiser` enforces this in CI.
7. **New external dependency = new port + adapter.** Payments, storage, email,
   SMS all sit behind interfaces with an in-memory fake for tests.
8. **TSDoc on every exported symbol.** One-line intent + `@param`/`@returns`.
   Lint blocks merges without it. (See `docs/DOCUMENTATION.md`.)
9. **Secrets only in env / platform secret store.** Never in this repo, never in
   markdown, never in client bundles. Separate test/live keys.
10. **One change = one Conventional Commit + docs update.** See the loop below.

## The per-change documentation loop (run on EVERY change)

1. Write/refresh **TSDoc** on touched exported symbols.
2. Write a **Conventional Commit** (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, scoped e.g. `feat(payments):`).
3. If an architectural decision was made → add an **ADR** in `docs/adr/`.
4. Update the relevant **`docs/` page** if behavior/contract changed.
5. `CHANGELOG.md` is generated from commits — do not hand-edit it.

## Commands

```bash
npm run dev          # local dev (expects Docker Compose Postgres up)
npm run db:up        # docker compose up postgres
npm run db:migrate   # apply Drizzle migrations
npm run db:seed      # seed dev tenants + users
npm run test         # unit + integration (includes cross-tenant BOLA tests)
npm run lint         # eslint + dependency-cruiser + tsdoc
npm run typecheck    # tsc --noEmit
npm run check        # lint + typecheck + test  (run before every commit)
```

## Definition of Done

A task is done only when `npm run check` is green AND the per-change
documentation loop is complete AND authorization is enforced server-side AND a
cross-tenant test exists for any new data-access path. Full checklist:
`docs/DEFINITION_OF_DONE.md`.

## Ask first (do not decide unilaterally)

- Changing the stack, tenancy model, or auth strategy
- Adding a paid third-party service or a heavy dependency
- Any schema change that drops/renames columns or touches RLS policies
- Anything that changes what data a role/tenant can see
- Touching payment status transitions or money math

## Never

- Disable RLS, `BYPASSRLS`, or run the app as the table owner
- Weaken or skip a security/authz check "to make a test pass"
- Force-push to `main`, rewrite shared history, or commit secrets
- Hand-edit generated files (`CHANGELOG.md`, migrations history, lockfiles)
- Store card data, log full PII, or log secrets

## Where to look (load on demand)

| Need | File |
|---|---|
| Module map, layering, dependency rule | `docs/ARCHITECTURE.md` |
| Security controls, OWASP, file upload, BOLA | `docs/SECURITY.md` |
| Data Privacy Act, NPC, consent, breach | `docs/COMPLIANCE.md` |
| UX rules, mobile-first, WCAG 2.2 AA | `docs/UIUX.md` |
| Design system, pages, visual direction | `docs/DESIGN.md` |
| Modules + entitlements model | `docs/FEATURES.md` |
| Docs/commenting/changelog discipline | `docs/DOCUMENTATION.md` |
| Definition of Done checklist | `docs/DEFINITION_OF_DONE.md` |
| Domain vocabulary (use these exact terms) | `docs/GLOSSARY.md` |
| Why we decided X | `docs/adr/` |
| Commit + PR workflow | `CONTRIBUTING.md` |
