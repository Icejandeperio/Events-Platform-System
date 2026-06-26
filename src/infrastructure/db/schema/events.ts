/**
 * Events and pricing-tier table definitions.
 *
 * @remarks All tables are tenant-scoped with RLS on `tenant_id`.
 */

import { pgPolicy, pgTable, text, timestamp, uuid, integer, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organization } from './auth';

/** Status values for an event. */
export type EventStatus = 'draft' | 'open' | 'closed' | 'cancelled';

/**
 * Events table — a schedulable offering participants register for.
 *
 * @remarks
 * `status` lifecycle: `draft → open → closed | cancelled`.
 * Capacity is enforced at the use-case layer (not a DB constraint) to allow
 * grace-period registrations at the discretion of tenant_admin.
 */
export const events = pgTable(
  'events',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    /** ISO date string for event start; stored as text for timezone-aware display. */
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    location: text('location'),
    /** Null means unlimited. */
    capacityLimit: integer('capacity_limit'),
    status: text('status').notNull().default('draft').$type<EventStatus>(),
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

/**
 * Pricing tiers for an event — e.g. Early Bird, Regular, Late.
 *
 * @remarks
 * `amount` is in integer centavos (PHP) — never floats (SECURITY.md §8, GLOSSARY).
 * `tenant_id` is denormalized from the parent event so RLS can filter directly
 * without a join (a JOIN in an RLS USING clause is both fragile and slow).
 */
export const pricingTiers = pgTable(
  'pricing_tiers',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Price in integer centavos (₱1 = 100). */
    amount: integer('amount').notNull(),
    /** Null means unlimited availability. */
    availableSlots: integer('available_slots'),
    /** Whether this tier is currently open for selection. */
    isActive: boolean('is_active').notNull().default(true),
    /** Soft-ordering for display in the registration UI. */
    sortOrder: integer('sort_order').notNull().default(0),
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
