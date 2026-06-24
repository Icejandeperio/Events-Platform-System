# 0004. Authentication via Better Auth (supersedes auth choice in 0002)

- Status: Accepted
- Date: 2026-06-24
- Deciders: Founder/Operator, Lead Engineer
- Supersedes: auth-library portion of ADR 0002

## Context

ADR 0002 selected Auth.js (next-auth v5) as the authentication library. As of
mid-2026, Auth.js's own maintainers direct new projects to Better Auth — Auth.js
is now maintained by the Better Auth team and `authjs.dev` includes a formal
migration guide. Better Auth is also the stronger technical fit for this project:

- First-party **Organization plugin** provides multi-tenant membership, roles,
  and invitations, mapping cleanly onto our `tenant_id` isolation model.
- Built-in **MFA / 2FA plugins** (required for `tenant_admin` and `super_admin`
  per `docs/SECURITY.md`).
- TypeScript-first, end-to-end typed sessions with no v5-beta caveats.
- Database-backed sessions, fully revocable — same property we required of Auth.js.

## Decision

Use **Better Auth** with the **Organization plugin** for all tenant-scoped
authentication. Auth.js is not adopted.

## Role ↔ Organization model mapping

Better Auth's Organization plugin is a two-level model: **organizations** and
**members**. We map our four roles onto it as follows:

| Our role | Better Auth concept | Notes |
|---|---|---|
| `tenant_admin` | org member with role `owner` or `admin` | Full control within their org |
| `staff` | org member with role `member` | Operational; limited write access |
| `participant` | org member with role `member` (custom) OR stand-alone user | Registered for events; may not have an org account |
| `super_admin` | **platform-level user flag** — NOT in any tenant org | See below |

**Participants** are a special case: event participants may register without an
account (guest flow) or with a lightweight account. When they have an account,
they appear as org members with a `participant` custom role. The registration
use case does not require org membership — only payment and check-in do.

## Super-admin placement (outside the org model)

`super_admin` is a platform-wide role that must cross tenant boundaries with
explicit, audited operations. It does not belong to any tenant organization.

Implementation:
1. Better Auth exposes a `user.role` field (top-level, not org-scoped). We set
   `role: "super_admin"` on platform users directly on the `user` table.
2. The `withTenant()` wrapper checks `session.user.role === "super_admin"` and,
   if true, **skips the RLS tenant-context SET** — the super-admin's queries run
   under an explicit `tenant_id` parameter passed by the calling use case, not
   from the session.
3. Every super-admin cross-tenant operation is audit-logged (tenant accessed,
   action, timestamp, super-admin user ID) before the query executes.
4. The super-admin UI (`/platform/*`) is a separate Next.js route group whose
   middleware asserts `role === "super_admin"` server-side on every request.

This keeps RLS as an unbroken backstop for all non-super-admin traffic while
giving the platform admin explicit, traceable cross-tenant access.

## Better Auth session → `withTenant()` integration

Better Auth's Organization plugin stores the user's currently active org in the
session:

```ts
// session.session.activeOrganizationId — set by Better Auth on org switch
```

`withTenant()` extracts this value and calls:

```sql
SET LOCAL app.current_tenant = '<activeOrganizationId>';
```

The `activeOrganizationId` **is** our `tenant_id` (UUIDv4, set when the tenant
is created in our system). No translation layer needed.

If `activeOrganizationId` is null and the user is not a `super_admin`, the
request is rejected with 401 — there is no valid tenant context.

## Alternatives considered

- **Auth.js v5** — the prior choice. Maintainers now direct new projects to
  Better Auth; no native org/multi-tenant plugin; email/password flow is manual.
  Rejected.
- **Clerk** — excellent DX but per-MAU pricing and hosted lock-in; data-control
  concerns for PII under RA 10173. Rejected.
- **Custom JWT auth** — maximum control but significant security surface to
  maintain (token rotation, revocation, MFA). Unjustified for an MVP. Rejected.

## Consequences

- Better Auth's Organization plugin directly models our multi-tenant RBAC,
  removing the need to hand-roll invitation and membership flows.
- The `activeOrganizationId` → `tenant_id` mapping is a one-line extraction in
  `withTenant()`, keeping the RLS contract unchanged.
- `super_admin` remains entirely outside the tenant org model, preserving clean
  isolation: a super-admin cannot accidentally inherit a tenant's RLS context.
- MFA for admins is a plugin toggle, not a build task.
- Better Auth is newer than Auth.js; monitor for breaking changes during Stage 1.
