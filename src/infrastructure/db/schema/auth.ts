/**
 * Better Auth table definitions — managed by the Better Auth Drizzle adapter.
 *
 * @remarks
 * Property names are camelCase matching Better Auth's internal field names;
 * Drizzle maps them to quoted camelCase DB column names automatically.
 *
 * `organization.id` uses `uuid()` so our application tables can declare
 * `tenant_id uuid NOT NULL REFERENCES organization(id)` with proper type
 * safety at the DB level. Better Auth is configured with
 * `advanced.generateId: () => crypto.randomUUID()` so all generated IDs are
 * UUID strings regardless of the column type.
 *
 * RLS status (rationale required by ADR 0001 + ADR 0004):
 * - `user`         NO RLS — platform-wide identity table; queried during login
 *                  before any tenant context is established.
 * - `session`      NO RLS — sessions span orgs; the active-org switch IS a
 *                  mutation on this table so it cannot itself be tenant-gated.
 * - `account`      NO RLS — OAuth provider accounts are platform-level.
 * - `verification` NO RLS — email / magic-link tokens are platform-level.
 * - `organization` NO RLS — the org IS the tenant definition; queried by slug
 *                  during auth flows (invite, login) before `app.current_tenant`
 *                  is set. Application-layer checks in `withTenant()` are the
 *                  primary boundary for cross-org data disclosure.
 * - `member`       RLS on `"organizationId"` — membership is tenant data.
 * - `invitation`   RLS on `"organizationId"` — invitations are tenant data.
 */

import { boolean, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Platform-wide tables (NO RLS) ─────────────────────────────────────────────

/** Better Auth `user` table — one row per platform account. */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  /** Platform-level role flag; not an org role. Default `user`; `super_admin` is explicit (ADR 0004). */
  platformRole: text('platformRole').notNull().default('user'),
});

/** Better Auth `session` table — one row per active user session. */
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  /** The org (= tenant) the user is currently acting within. */
  activeOrganizationId: text('activeOrganizationId'),
});

/** Better Auth `account` table — OAuth provider account bindings. */
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  /** External provider user ID (not our UUID — may be any string). */
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

/** Better Auth `verification` table — email / magic-link tokens. */
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

// ── Organization plugin tables ─────────────────────────────────────────────────

/**
 * Better Auth `organization` table — one row per tenant.
 *
 * @remarks
 * `organization.id` is the `tenant_id` used throughout the system (ADR 0004).
 * It is typed as `uuid` so application tables can FK-reference it as
 * `tenant_id uuid NOT NULL`. Better Auth's `generateId` is configured to
 * return `crypto.randomUUID()` ensuring UUID-format values.
 * No RLS: see file-level rationale.
 */
export const organization = pgTable('organization', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  metadata: text('metadata'),
});

/**
 * Better Auth `member` table — org membership; RLS-protected tenant data.
 *
 * @remarks
 * Policy compares `"organizationId"` (uuid) against `app.current_tenant`
 * set by `withTenant()` at the start of each request transaction.
 */
export const member = pgTable(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: uuid('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  () => [
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'tenantkit_app',
      using: sql`"organizationId" = current_setting('app.current_tenant', true)::uuid`,
      withCheck: sql`"organizationId" = current_setting('app.current_tenant', true)::uuid`,
    }),
  ],
).enableRLS();

/**
 * Better Auth `invitation` table — pending org invites; RLS-protected tenant data.
 *
 * @remarks Policy mirrors `member` — filters on `"organizationId"`.
 */
export const invitation = pgTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: uuid('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expiresAt').notNull(),
    inviterId: text('inviterId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  () => [
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'tenantkit_app',
      using: sql`"organizationId" = current_setting('app.current_tenant', true)::uuid`,
      withCheck: sql`"organizationId" = current_setting('app.current_tenant', true)::uuid`,
    }),
  ],
).enableRLS();
