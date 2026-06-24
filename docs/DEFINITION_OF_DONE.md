# Definition of Done

A task/PR is **Done** only when every applicable box is checked. "It works on my
machine" is not Done. Agents and humans both apply this list.

## Always
- [ ] `npm run check` is green (lint + typecheck + tests)
- [ ] TypeScript strict — no `any` leaks, no `@ts-ignore` without a justifying comment
- [ ] `dependency-cruiser` passes (no illegal layer imports)
- [ ] TSDoc present on every new/changed exported symbol; file headers present
- [ ] Conventional Commit(s) written; no hand-edited `CHANGELOG.md`
- [ ] No secrets committed (Gitleaks clean); no hardcoded credentials
- [ ] Relevant `docs/` page updated if behavior/contract/data model changed
- [ ] ADR added if an architectural decision was made

## Security & tenancy (any data-access path)
- [ ] All queries tenant-scoped via `withTenant()`; RLS policy exists for new tables
- [ ] Server-side authorization: tenant + role + object ownership checked
- [ ] **Two-tenant cross-access test** added/passing (A cannot touch B)
- [ ] Public IDs are UUIDv4; no sequential IDs exposed
- [ ] Input/output validated with Zod DTOs; no body-spreading; no whole-row returns
- [ ] New endpoints rate-limited if abuse-prone; list endpoints paginated/capped

## Payments (if touched)
- [ ] No card data on our servers; money is integer minor units via `Money`
- [ ] Status transitions valid and audit-logged; webhooks (if any) verified +
      idempotent + deduplicated by event ID

## File uploads (if touched)
- [ ] Magic-byte validation; UUID filename; size limit; object storage outside web root
- [ ] Served only via authenticated tenant-scoped controller; EXIF stripped

## UI (if user-facing)
- [ ] Mobile-first; correct input types/autocomplete; explicit loading/error/empty states
- [ ] WCAG 2.2 AA: contrast, focus visible, 24px+ targets, keyboard-operable, labels
- [ ] axe check clean on changed screens

## Compliance (if PII or new processing)
- [ ] Data minimization respected; consent captured where required
- [ ] PII access audit-logged; retention considered
- [ ] Processing register updated; PIA re-run if a new processing activity was added

## Modules (if a module)
- [ ] `assertEntitled(tenant, '<module>')` guard on every module route/use case
- [ ] Disabling the entitlement cleanly removes behavior without breaking core
- [ ] Module documented in `docs/FEATURES.md`
