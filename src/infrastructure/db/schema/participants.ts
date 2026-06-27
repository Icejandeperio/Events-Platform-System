/**
 * Participant table definition.
 *
 * @remarks Tenant-scoped; RLS on `tenant_id`.
 */

import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organization } from './auth';

/**
 * Participants table — end customers who register for events.
 *
 * @remarks
 * A participant may or may not have a Better Auth `user` account. The
 * `userId` column is nullable to support the guest-registration flow
 * (ADR 0004: participants may register without a platform account).
 * `email` and `phone` are personal data under RA 10173 — log access,
 * never log their values in full (COMPLIANCE.md).
 */
export const participants = pgTable(
  'participants',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    /** Nullable: guest participants may not have a platform account. */
    userId: text('user_id'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
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
