/**
 * Compliance table definitions — consent records and audit log.
 *
 * @remarks Both tables are tenant-scoped with RLS on `tenant_id`.
 */

import { pgPolicy, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organization } from './auth';

/**
 * Consent records — explicit consent capture required by RA 10173 (Philippines DPA).
 *
 * @remarks
 * One record per consent event per participant. `consentText` captures the
 * exact wording shown to the participant at the time of consent — do not
 * update or delete rows (immutable audit trail).
 * See COMPLIANCE.md for NPC obligations and breach-notification procedures.
 */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    /** The participant who gave consent (nullable for anonymous pre-registration). */
    participantId: uuid('participant_id'),
    /** Exact wording displayed to the participant (snapshot — never update). */
    consentText: text('consent_text').notNull(),
    /** Version tag for the privacy notice (e.g. "v1.0", "2026-06-01"). */
    privacyPolicyVersion: text('privacy_policy_version').notNull(),
    /** How consent was given — e.g. `form_checkbox`, `email_confirmation`. */
    method: text('method').notNull(),
    givenAt: timestamp('given_at', { withTimezone: true }).notNull().defaultNow(),
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
 * Audit log — append-only record of sensitive actions.
 *
 * @remarks
 * Covers: auth events, PII access, payment-status changes, file access,
 * role/entitlement changes, and super_admin cross-tenant operations (SECURITY §7).
 * `tenant_id` is required and NOT NULL — super_admin cross-tenant operations
 * specify the TARGET tenant's ID explicitly so the log is always tenant-tagged.
 * `metadata` carries action-specific detail; mask secrets and PII — log only
 * references (IDs), not raw values (SECURITY §7).
 * Rows must NEVER be deleted or updated — treat as append-only.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    /** The user who performed the action (null for system/webhook events). */
    actorId: text('actor_id'),
    /** Namespaced action slug: `payment.confirmed`, `member.role_changed`, etc. */
    action: text('action').notNull(),
    /** Resource type acted upon (e.g. `payment`, `participant`, `event`). */
    resourceType: text('resource_type').notNull(),
    /** UUID of the affected resource. */
    resourceId: uuid('resource_id').notNull(),
    /** Structured detail — mask PII (IDs only), no secrets. */
    metadata: jsonb('metadata'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
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
