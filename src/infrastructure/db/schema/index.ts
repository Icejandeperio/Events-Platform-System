/**
 * Drizzle schema barrel — re-exports all table definitions.
 *
 * @remarks
 * Import from this barrel in the Drizzle client and drizzle-kit config.
 * Every tenant-owned table has `tenant_id uuid NOT NULL` with an RLS policy
 * enforcing `tenant_id = current_setting('app.current_tenant')::uuid`
 * (ARCHITECTURE.md §4, ADR 0001, ADR 0004).
 */

export * from './auth';
export * from './events';
export * from './participants';
export * from './payments';
export * from './entitlements';
export * from './compliance';
