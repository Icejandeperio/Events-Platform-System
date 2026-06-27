import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client';
import * as schema from '../db/schema';

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
 * `advanced.generateId` returns `crypto.randomUUID()` so all Better Auth
 * generated IDs are UUID strings — required for `organization.id uuid`
 * to serve as `tenant_id` in application tables (ADR 0001).
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),

  plugins: [
    organization({
      allowUserToCreateOrganization: false,
      membershipRoles: ['owner', 'admin', 'member'],
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days absolute
    updateAge: 60 * 60 * 24, // refresh session cookie daily
  },

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

  advanced: {
    database: {
      // All Better Auth-generated IDs are UUIDs so organization.id (typed uuid)
      // can serve as the FK target for tenant_id in application tables.
      generateId: () => crypto.randomUUID(),
    },
  },
});

/** Inferred session type from Better Auth, extended with our additionalFields. */
export type Session = typeof auth.$Infer.Session;
