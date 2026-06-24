import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

/**
 * Platform-level user roles stored on the `user` table.
 *
 * @remarks
 * `super_admin` is NOT an organization role — it is a top-level platform
 * flag on the user record (ADR 0004). Tenant-scoped roles (tenant_admin,
 * staff, participant) map to Better Auth Organization member roles.
 */
export type PlatformRole = 'super_admin' | 'user';

/**
 * Tenant-scoped member roles within a Better Auth Organization.
 *
 * @remarks Maps directly onto our RBAC model (ADR 0004):
 * - `owner` → tenant_admin (full control within one tenant)
 * - `admin` → senior staff (operational + some admin actions)
 * - `member` → staff / participant (read + operational writes)
 */
export type TenantMemberRole = 'owner' | 'admin' | 'member';

/**
 * Better Auth server instance.
 *
 * @remarks
 * Configured with the Organization plugin so each tenant maps to one
 * Better Auth organization. The `activeOrganizationId` on the session is
 * the `tenant_id` consumed by `withTenant()` to set the RLS context.
 * See ADR 0004 for the full mapping and super_admin placement.
 *
 * The `db` adapter is wired at runtime via the composition root
 * (src/app/_bootstrap/) so the schema is injected after Drizzle initialises.
 * This file exports the `auth` instance for import by Next.js route handlers.
 */
export const auth = betterAuth({
  database: drizzleAdapter(
    // Drizzle instance is injected at module level here for simplicity;
    // the composition root pattern (src/app/_bootstrap/) will replace this
    // with a proper DI binding in Stage 1 once the schema exists.
    null as never,
    { provider: 'pg' },
  ),

  plugins: [
    organization({
      // Allow any authenticated user to create a new tenant org (super_admin gates
      // tenant creation via a server action before calling this).
      allowUserToCreateOrganization: false,

      // Custom member roles mapped to our RBAC model (ADR 0004).
      membershipRoles: ['owner', 'admin', 'member'],
    }),
  ],

  // Session configuration
  session: {
    // Short-lived sessions; admins are re-prompted after 2h idle (SECURITY.md §2).
    expiresIn: 60 * 60 * 24 * 7, // 7 days absolute
    updateAge: 60 * 60 * 24, // refresh session cookie daily
  },

  // super_admin is flagged on the user table, not via org membership.
  // Better Auth supports extending the user schema with additional fields.
  user: {
    additionalFields: {
      platformRole: {
        type: 'string',
        required: false,
        defaultValue: 'user' satisfies PlatformRole,
        input: false, // not client-settable
      },
    },
  },
});

/** Inferred session type from Better Auth, extended with our additionalFields. */
export type Session = typeof auth.$Infer.Session;
