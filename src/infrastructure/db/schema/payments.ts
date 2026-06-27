/**
 * Registration and payment table definitions.
 *
 * @remarks Both tables are tenant-scoped with RLS on `tenant_id`.
 */

import { pgPolicy, pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organization } from './auth';
import { events, pricingTiers } from './events';
import { participants } from './participants';

/**
 * Registrations — the act of a participant signing up for an event.
 *
 * @remarks
 * One registration per participant per event (enforced at use-case layer).
 * Status reflects registration lifecycle: `pending` (registered, awaiting
 * payment), `confirmed` (payment verified), `cancelled`.
 */
export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    pricingTierId: uuid('pricing_tier_id').references(() => pricingTiers.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('pending'),
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
 * Payments — a payment record linked to a registration.
 *
 * @remarks
 * Status lifecycle: `PENDING → SUBMITTED → CONFIRMED | REJECTED`
 * A REJECTED payment returns to SUBMITTED when the participant re-uploads
 * proof (GLOSSARY). Amount is in integer centavos — never floats (SECURITY §8).
 * `proofUrl` is a storage reference (never a public direct URL — SECURITY §4).
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => registrations.id, { onDelete: 'restrict' }),
    /** Amount in integer centavos (₱1 = 100). */
    amount: integer('amount').notNull(),
    status: text('status').notNull().default('PENDING'),
    /** Storage reference for the proof-of-payment file — not a public URL. */
    proofUrl: text('proof_url'),
    /** Staff member who verified this payment; null until confirmed/rejected. */
    verifiedBy: text('verified_by'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /** Rejection reason shown to the participant on re-upload. */
    rejectionReason: text('rejection_reason'),
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
