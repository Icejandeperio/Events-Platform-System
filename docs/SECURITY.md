# Security Standards

Baseline: **OWASP Top 10 (2021)** + **OWASP API Security Top 10 (2023)** +
**OWASP ASVS 5.0 Level 2** (target for an app handling personal data and
payments). This file is the security contract. Security checks are never
weakened "to make a test pass."

## 1. The dominant risk: BOLA / IDOR (API1:2023)

Broken Object Level Authorization is the #1 API risk and the main multi-tenant
failure mode. Comparing the session user ID to a URL parameter is **not**
sufficient.

**Mandatory mitigations (all of them, layered):**

1. **RLS** at the database — the backstop (see `docs/ARCHITECTURE.md` §4).
2. **Explicit ownership checks** in the use-case layer for every object accessed
   by ID — verify the object's `tenant_id` matches the caller's tenant AND the
   caller's role permits the action.
3. **UUIDv4** public identifiers — never sequential integers.
4. **Two-tenant tests** in CI: seed tenant A and tenant B; assert A cannot read,
   list, update, or delete any of B's objects across every endpoint. A new
   data-access path without this test is not Done.

## 2. AuthN / AuthZ

- **Sessions:** Better Auth, **database-backed and revocable**. Short idle timeout
  for admin roles. No long-lived bearer tokens for human users.
- **Passwords:** hash with **Argon2id** (fallback bcrypt cost ≥ 12). Never store
  or log plaintext. No hardcoded or default credentials anywhere — ever.
- **MFA** required for `tenant_admin` and `super_admin`. _(Deferred to Stage 3 — see ADR 0005)_
- **RBAC roles:** `super_admin` (platform), `tenant_admin` (partner owner),
  `staff` (operations/marshal), `participant`. Function-level checks on every
  admin/super-admin route (OWASP API5 BFLA).
- **Entitlement checks are server-side and authoritative.** Hiding a UI button is
  cosmetic; the API must reject a disabled feature regardless of client state.

## 3. Input / output handling

- **Zod at every boundary.** Validate input; shape output with explicit DTOs.
- **No mass assignment** (OWASP API3 BOPLA): never spread a request body into a
  DB write; never return a whole row. Allowlist fields.
- Parameterized queries only (the ORM handles this) — no string-built SQL.
- Output-encode in the UI; rely on React's escaping; sanitize any HTML you must render.

## 4. Secure file upload (payment screenshots)

Treat every upload as hostile. Required controls:

- **Validate by magic bytes / signature**, not the client `Content-Type` or
  extension. Allowlist `image/jpeg`, `image/png`, `application/pdf` only.
- **Random UUID filename** — never trust the user-supplied name (blocks path
  traversal, null-byte, and double-extension attacks).
- **Size limit** (e.g. ≤ 8 MB) enforced at proxy and app layers.
- **Store in object storage outside the web root** (Vercel Blob / R2 / local
  `storage/` in dev) — never a publicly executable path. Serve only through an
  **authenticated, tenant-scoped controller**, never a public direct URL.
- **Re-encode images and strip EXIF**; set `Content-Disposition: attachment` and
  `X-Content-Type-Options: nosniff` when serving.
- Optional AV/CDR scan before a staff member opens the file.

## 5. Transport, headers, secrets

- **TLS 1.2+** everywhere. HSTS in production.
- Security headers via middleware: CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`/frame-ancestors. **Payment pages: strict CSP + script-integrity
  monitoring** (PCI v4 6.4.3 / 11.6.1).
- **CSRF:** SameSite cookies + anti-CSRF tokens for cookie-based mutations.
- **Secrets:** env / platform secret store only. Separate test vs live keys.
  Rotate on exposure. Gitleaks runs in pre-commit and CI.

## 6. Rate limiting & resource abuse (API4)

- Token-bucket / sliding-window on auth, registration, password reset, and upload
  endpoints (Redis/Upstash in serverless; in-memory limiter acceptable locally).
- Pagination caps on all list endpoints; reject unbounded queries.

## 7. Audit logging

Append-only, tenant-tagged log of: authentication events, PII access,
payment-status changes, file access, role/entitlement changes, and super-admin
impersonation. Never log secrets or full PII (mask). Logs support both incident
response and the Data Privacy Act's accountability requirement.

## 8. Payments security

- **No card data on our servers.** Hosted-gateway redirect only → PCI **SAQ-A**.
  A PAN in our database or logs is a critical incident.
- Money is integer minor units (centavos) in a `Money` value object — never floats.
- Gateway webhooks: verify signature, return 200 immediately, process async,
  **deduplicate by event ID**, and treat the webhook (not the browser redirect)
  as the source of truth. Use idempotency keys on payment POSTs.

## 9. Multi-tenant pitfalls (checklist)

- [ ] App DB role is not the owner and lacks `BYPASSRLS`
- [ ] `FORCE ROW LEVEL SECURITY` on every tenant table
- [ ] Tenant context set per request via `withTenant()`; never global/mutable
- [ ] Tenant resolution is a pluggable strategy, not hardcoded
- [ ] Cross-tenant/super-admin paths are explicit and audited
- [ ] Every list/detail endpoint covered by a two-tenant test

## 10. CI security gates

`npm run check` plus: `dependency-cruiser` (layering), Gitleaks (secrets),
`npm audit`/Dependabot (vulnerable deps), and the cross-tenant test suite. A red
gate blocks merge. ASVS L2 requirements are mapped to tests where automatable.
