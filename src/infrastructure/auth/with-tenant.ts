import { sql } from 'drizzle-orm';
import { db, type AppDbTx } from '../db/client';
import type { Session } from './auth';

/**
 * Tenant-context resolved from a Better Auth session.
 *
 * @remarks
 * Returned by `resolveTenantContext()` and consumed internally by `withTenant()`
 * to set `app.current_tenant` before executing a DB callback.
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
 * Rules (ADR 0004):
 * 1. `super_admin` → `superAdminTargetTenantId` is required; throws if absent.
 * 2. All other roles → `tenantId` = `session.session.activeOrganizationId`.
 * 3. Missing active org for a non-admin → throws (no valid tenant context).
 * @param session - A validated Better Auth session.
 * @param superAdminTargetTenantId - Required when caller is super_admin.
 * @returns The resolved `TenantContext`.
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

  // Better Auth's organization plugin adds activeOrganizationId to the session
  // record at runtime. The TypeScript $Infer.Session type doesn't reflect this
  // automatically — the cast is safe because the Drizzle schema and org plugin
  // both define the column.
  const tenantId = (session.session as Record<string, unknown>)['activeOrganizationId'] as
    | string
    | null
    | undefined;
  if (!tenantId) {
    throw new Error(
      'No active organization on session — cannot determine tenant context. ' +
        'Ensure the client calls setActiveOrganization before this request.',
    );
  }

  return { tenantId, session, isSuperAdmin: false };
}

/**
 * Executes a database callback inside a tenant-scoped transaction.
 *
 * @remarks
 * Opens a Drizzle transaction, runs `SET LOCAL app.current_tenant = <tenantId>`,
 * then calls `fn` with the transaction handle. RLS policies on all tenant
 * tables filter by this setting automatically (ADR 0001, ARCHITECTURE.md §4).
 *
 * For super_admin callers: the `tenantId` comes from the explicit
 * `superAdminTargetTenantId` parameter (never from the session), ensuring
 * cross-tenant access is always audited and intentional (ADR 0004).
 * @param session - A validated Better Auth session.
 * @param fn - Callback that receives the RLS-scoped transaction.
 * @param superAdminTargetTenantId - Required when caller is super_admin.
 * @returns The return value of `fn`.
 */
export async function withTenant<T>(
  session: Session,
  fn: (tx: AppDbTx) => Promise<T>,
  superAdminTargetTenantId?: string,
): Promise<T> {
  const { tenantId } = resolveTenantContext(session, superAdminTargetTenantId);
  return executeInTenantContext(tenantId, fn);
}

/**
 * Low-level helper: opens a transaction and sets `app.current_tenant`.
 *
 * @remarks
 * Called by `withTenant()` and directly by integration tests that supply a
 * raw tenant UUID without constructing a full session.
 * @param tenantId - The UUID of the target tenant.
 * @param fn - Callback that receives the RLS-scoped transaction.
 * @returns The return value of `fn`.
 */
export async function executeInTenantContext<T>(
  tenantId: string,
  fn: (tx: AppDbTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL is transaction-scoped — it is automatically cleared when the
    // transaction commits or rolls back (no cross-request leakage possible).
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
    return fn(tx);
  });
}
