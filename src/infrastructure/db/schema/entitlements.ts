/**
 * Tenant entitlements table — per-tenant module flags.
 *
 * @remarks Tenant-scoped with RLS on `tenant_id`.
 */

import { pgPolicy, pgTable, text, timestamp, uuid, boolean, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organization } from './auth';

/**
 * Tenant entitlements — which optional modules are enabled per tenant.
 *
 * @remarks
 * Module keys are stable strings from FEATURES.md §2. The `limits` jsonb
 * stores optional usage caps (e.g. `{ "max_events": 10 }`). Entitlement
 * checks are always server-side — never trust the client (SECURITY.md §2).
 * Enabling/disabling a module is a super_admin action (FEATURES.md §4).
 */
export const tenantEntitlements = pgTable(
  'tenant_entitlements',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    /** Stable module key from FEATURES.md §2 (e.g. `checkin`, `gateway_payments`). */
    moduleKey: text('module_key').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    /** Optional jsonb usage limits (e.g. `{ "max_events": 10 }`). */
    limits: jsonb('limits'),
    /** Billing plan associated with this entitlement. */
    plan: text('plan'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'tenantkit_app',
      using: sql`tenant_id = current_setting('app.current_tenant', true)::uuid`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant', true)::uuid`,
    }),
  ],
).enableRLS();
