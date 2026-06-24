# TenantKit

Multi-tenant event registration and payment-management SaaS. A reusable core
(participant registration, participant/payment tracking, staff dashboard) with
optional per-tenant modules (QR check-in, offline PWA, GPS, TOTP, and more)
controlled by entitlements. First client: **Philippine Adventure Tour (PAT)**.

> The platform name **TenantKit** is a working name and can be changed later.

## Status

MVP, local-first development. Serverless migration (Vercel + Neon) is triggered
when the first paying client is signed. Payments run a manual
screenshot-and-verify flow now, behind a `PaymentProvider` port so a real
gateway (PayMongo) drops in later with no core changes.

## Tech stack

- **Next.js 16 (App Router)** + **TypeScript (strict)**
- **PostgreSQL** + **Drizzle ORM**, multi-tenant via **Row-Level Security**
- **Hexagonal (ports & adapters)** architecture
- **Better Auth** (DB-backed sessions) + **RBAC** + **per-tenant entitlements**
- **shadcn/ui** (Radix + Tailwind v4) for UI; **shadcn/ui charts (Recharts)** for dashboards
- Local: **Docker Compose**. Serverless: **Vercel + Neon**. Files: **Vercel Blob / R2**.

## Quick start

```bash
npm install
cp .env.example .env        # fill in local values (never commit .env)
npm run db:up               # start Postgres via Docker Compose
npm run db:migrate
npm run db:seed
npm run dev                 # http://localhost:3000
```

## Working in this repo

Read **`CLAUDE.md`** first (agent and human operating manual). All standards
live in **`docs/`**. Decisions are recorded as ADRs in **`docs/adr/`**. Commits
follow Conventional Commits (`CONTRIBUTING.md`); `CHANGELOG.md` is generated.

## Documentation map

| Topic                          | File                         |
| ------------------------------ | ---------------------------- |
| Agent/human operating manual   | `CLAUDE.md`                  |
| Architecture & module map      | `docs/ARCHITECTURE.md`       |
| Security standards             | `docs/SECURITY.md`           |
| Data-privacy & compliance      | `docs/COMPLIANCE.md`         |
| UI/UX standards                | `docs/UIUX.md`               |
| Design system & page inventory | `docs/DESIGN.md`             |
| Modules & entitlements         | `docs/FEATURES.md`           |
| Documentation discipline       | `docs/DOCUMENTATION.md`      |
| Definition of Done             | `docs/DEFINITION_OF_DONE.md` |
| Glossary                       | `docs/GLOSSARY.md`           |
| Architecture decisions         | `docs/adr/`                  |

## License

Proprietary. © TenantKit. All rights reserved.
