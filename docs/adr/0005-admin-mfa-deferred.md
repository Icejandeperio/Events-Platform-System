# 0005. Admin MFA deferred to Stage 3

- Status: Accepted
- Date: 2026-06-30
- Deciders: Founder/Operator, Lead Engineer

## Context

`docs/SECURITY.md §2` requires MFA for `tenant_admin` and `super_admin`. Better
Auth ships a first-party TOTP plugin (`better-auth/plugins/totp`) and a backup-code
plugin that satisfy this requirement with minimal integration effort.

This milestone (M3d) completes the local-first MVP: login, participant registration,
proof upload, and the staff verification queue. The project targets a single paying
client (Philippine Adventure Tour) running on a private LAN event, not an internet-
facing deployment. No card data is handled by this system (PCI SAQ-A, gateway
redirect only). The admin account is seeded in a controlled environment.

Deferring MFA to Stage 3 does not expose participant payment data to a new threat
actor: RLS prevents cross-tenant reads, the proof-serve route is staff/admin-only,
and admin credentials are managed outside the application.

## Decision

MFA for `tenant_admin` and `super_admin` is **deferred to Stage 3** (cloud
deployment / production hardening).

Stage 3 must:

1. Enable the Better Auth TOTP plugin.
2. Enforce MFA enrollment for all users with `role = owner` or `platformRole = super_admin`
   before they can access any admin-level route.
3. Gate the MFA-required paths in middleware (`requireMfa()` helper analogous to
   `requireRole()`), not just in UI.
4. Add integration tests that confirm an `owner` without a registered TOTP device
   is redirected to the enroll flow, not silently passed through.

## Consequences

- **Accepted risk:** Until Stage 3, an admin account takeover (compromised password)
  is not blocked by a second factor. Mitigated by controlled deployment and short
  session expiry.
- **Tracked obligation:** This ADR is referenced in `docs/SECURITY.md §2` so the
  deferral is not a silent omission from the security contract.
- **No code change required at Stage 3:** The Better Auth TOTP plugin is additive;
  enabling it does not require a schema migration of existing user rows.
