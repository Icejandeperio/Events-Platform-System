<!-- Title must be a valid Conventional Commit, e.g. feat(payments): ... -->

## What & why
<!-- What does this change do, and why? Link the issue/task. -->

## How tested
<!-- Commands run, scenarios covered. Note cross-tenant test if data-access changed. -->

## Docs & decisions
- [ ] TSDoc added/updated on touched exports
- [ ] `docs/` page updated (which: __________) or N/A
- [ ] ADR added (which: __________) or N/A
- [ ] Conventional Commit(s); `CHANGELOG.md` not hand-edited

## Definition of Done (see docs/DEFINITION_OF_DONE.md)
- [ ] `npm run check` green (lint + typecheck + tests)
- [ ] `dependency-cruiser` passes (no illegal layer imports)
- [ ] Server-side authz: tenant + role + ownership enforced
- [ ] Queries tenant-scoped via `withTenant()`; RLS policy for any new table
- [ ] Two-tenant cross-access test (if a data-access path changed)
- [ ] Zod DTOs in/out; UUIDv4 public IDs; no secrets committed
- [ ] UI: mobile-first + WCAG 2.2 AA (if user-facing)
- [ ] Compliance: data minimization/consent/audit (if PII or new processing)
- [ ] Module guard `assertEntitled(...)` (if a module)

## Risk / rollback
<!-- Anything risky? How to revert? Any migration or RLS-policy change? -->
