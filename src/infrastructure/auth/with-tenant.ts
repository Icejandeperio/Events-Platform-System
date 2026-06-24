import type { Session } from './auth';

/**
 * Tenant-context result from resolving a request's tenant.
 *
 * @remarks
 * Used by `withTenant()` to pass the resolved tenant ID and session
 * down to the Drizzle query executor (Stage 1 will wire this to a real
 * Drizzle instance via `SET LOCAL app.current_tenant`).
 */
export interface TenantContext {
  /** The resolved tenant UUID — set as `app.current_tenant` in Postgres RLS. */
  readonly tenantId: string;
  /** The validated user session. */
  readonly session: Session;
  /** True when the caller is a platform super_admin acting cross-tenant. */
  readonly isSuperAdmin: boolean;
}

/**
 * Resolves the tenant context from a Better Auth session.
 *
 * @remarks
 * This is the gateway to `SET LOCAL app.current_tenant` in every DB
 * transaction (ADR 0001, ADR 0004, ARCHITECTURE.md §4). Rules:
 * 1. If the user has `platformRole === 'super_admin'`, the `tenantId`
 *    must be explicitly provided by the caller (never from the session);
 *    the super_admin context is audited separately.
 * 2. For all other roles the `tenantId` is `session.session.activeOrganizationId`.
 * 3. If `activeOrganizationId` is null and the caller is not super_admin,
 *    we throw — there is no valid tenant context.
 *
 * In Stage 1 this function will open a Drizzle transaction and run
 * `SET LOCAL app.current_tenant = <tenantId>` before executing the
 * callback. The skeleton here returns the resolved context only.
 * @param session - A validated Better Auth session.
 * @param superAdminTargetTenantId - Required when caller is super_admin;
 *   the tenant they are explicitly targeting for this operation.
 * @returns The resolved `TenantContext`.
 * @throws Error when tenant context cannot be determined.
 */
export function resolveTenantContext(
  session: Session,
  superAdminTargetTenantId?: string,
): TenantContext {
  const isSuperAdmin = (session.user as { platformRole?: string }).platformRole === 'super_admin';

  if (isSuperAdmin) {
    if (!superAdminTargetTenantId) {
      throw new Error(
        'super_admin must explicitly specify the target tenantId for cross-tenant operations',
      );
    }
    return { tenantId: superAdminTargetTenantId, session, isSuperAdmin: true };
  }

  const tenantId = session.session.activeOrganizationId;
  if (!tenantId) {
    throw new Error(
      'No active organization on session — cannot determine tenant context. ' +
        'Ensure the client calls setActiveOrganization before this request.',
    );
  }

  return { tenantId, session, isSuperAdmin: false };
}
