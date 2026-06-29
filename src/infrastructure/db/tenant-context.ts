import { sql } from 'drizzle-orm';
import type { AppDb, AppDbTx } from './client';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * Executes a database callback inside a tenant-scoped transaction.
 *
 * @remarks
 * Opens a Drizzle transaction, sets `app.current_tenant` for the duration of
 * that transaction, then calls `fn` with the scoped handle. Because
 * `set_config('app.current_tenant', …, true)` is transaction-local, the setting
 * is automatically cleared on commit or rollback — there is no cross-request
 * leakage (ARCHITECTURE.md §4, ADR 0001).
 *
 * This utility is for use by infrastructure adapters that receive `AppDb` via
 * dependency injection. It differs from `auth/with-tenant.ts` (which derives
 * the tenant UUID from a Better Auth session) — this function accepts an already
 * resolved `TenantId` value object directly.
 *
 * @param db - The Drizzle db client to use (injected, never the global singleton).
 * @param tenantId - The tenant to scope the query to.
 * @param fn - Callback that receives the RLS-scoped transaction handle.
 * @returns The return value of `fn`.
 */
export async function withTenantContext<T>(
  db: AppDb,
  tenantId: TenantId,
  fn: (tx: AppDbTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL (true) binds the setting to the current transaction —
    // automatically reverted on commit/rollback, not just the statement.
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId.value}, true)`);
    return fn(tx);
  });
}
