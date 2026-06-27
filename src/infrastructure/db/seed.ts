/**
 * Dev/CI seed — creates two tenants and one user per RBAC role.
 *
 * @remarks
 * Runs as the DB owner (DATABASE_URL / superuser) so it bypasses RLS and
 * can insert data for multiple tenants in one script.
 * Run with: `npm run db:seed`
 * Idempotent: re-running will skip rows that already exist (ON CONFLICT DO NOTHING).
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const MIGRATION_URL = process.env['DATABASE_URL'];
if (!MIGRATION_URL) throw new Error('DATABASE_URL is not set — run `npm run db:up` first.');

const sql = postgres(MIGRATION_URL);
const db = drizzle(sql, { schema });

// ── Tenant IDs (stable UUIDs for repeatable seeds) ────────────────────────────
const PAT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_ID = '00000000-0000-4000-a000-000000000002';

// ── User IDs ──────────────────────────────────────────────────────────────────
const SUPER_ADMIN_ID = '00000000-0000-4000-b000-000000000001';
const PAT_ADMIN_ID = '00000000-0000-4000-b000-000000000002';
const PAT_STAFF_ID = '00000000-0000-4000-b000-000000000003';
const PAT_PARTICIPANT_ID = '00000000-0000-4000-b000-000000000004';
const TEST_ADMIN_ID = '00000000-0000-4000-b000-000000000005';
const TEST_STAFF_ID = '00000000-0000-4000-b000-000000000006';
const TEST_PARTICIPANT_ID = '00000000-0000-4000-b000-000000000007';

// ── Member IDs ────────────────────────────────────────────────────────────────
const MBR_PAT_ADMIN = '00000000-0000-4000-c000-000000000001';
const MBR_PAT_STAFF = '00000000-0000-4000-c000-000000000002';
const MBR_PAT_PARTICIPANT = '00000000-0000-4000-c000-000000000003';
const MBR_TEST_ADMIN = '00000000-0000-4000-c000-000000000004';
const MBR_TEST_STAFF = '00000000-0000-4000-c000-000000000005';
const MBR_TEST_PARTICIPANT = '00000000-0000-4000-c000-000000000006';

async function seed() {
  console.log('🌱  Seeding dev database...');

  // ── Organizations (tenants) ────────────────────────────────────────────────
  await db
    .insert(schema.organization)
    .values([
      { id: PAT_ID, name: 'Philippine Adventure Tour', slug: 'pat', createdAt: new Date() },
      { id: TEST_ID, name: 'Test Tenant', slug: 'test-tenant', createdAt: new Date() },
    ])
    .onConflictDoNothing();
  console.log('  ✓ organizations');

  // ── Users ─────────────────────────────────────────────────────────────────
  await db
    .insert(schema.user)
    .values([
      {
        id: SUPER_ADMIN_ID,
        name: 'Super Admin',
        email: 'super@tenantkit.dev',
        emailVerified: true,
        platformRole: 'super_admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: PAT_ADMIN_ID,
        name: 'PAT Admin',
        email: 'admin@pat.dev',
        emailVerified: true,
        platformRole: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: PAT_STAFF_ID,
        name: 'PAT Staff',
        email: 'staff@pat.dev',
        emailVerified: true,
        platformRole: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: PAT_PARTICIPANT_ID,
        name: 'PAT Participant',
        email: 'participant@pat.dev',
        emailVerified: true,
        platformRole: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: TEST_ADMIN_ID,
        name: 'Test Admin',
        email: 'admin@test.dev',
        emailVerified: true,
        platformRole: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: TEST_STAFF_ID,
        name: 'Test Staff',
        email: 'staff@test.dev',
        emailVerified: true,
        platformRole: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: TEST_PARTICIPANT_ID,
        name: 'Test Participant',
        email: 'participant@test.dev',
        emailVerified: true,
        platformRole: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    .onConflictDoNothing();
  console.log('  ✓ users');

  // ── Org members ───────────────────────────────────────────────────────────
  await db
    .insert(schema.member)
    .values([
      // PAT members
      {
        id: MBR_PAT_ADMIN,
        organizationId: PAT_ID,
        userId: PAT_ADMIN_ID,
        role: 'owner',
        createdAt: new Date(),
      },
      {
        id: MBR_PAT_STAFF,
        organizationId: PAT_ID,
        userId: PAT_STAFF_ID,
        role: 'member',
        createdAt: new Date(),
      },
      {
        id: MBR_PAT_PARTICIPANT,
        organizationId: PAT_ID,
        userId: PAT_PARTICIPANT_ID,
        role: 'member',
        createdAt: new Date(),
      },
      // Test tenant members
      {
        id: MBR_TEST_ADMIN,
        organizationId: TEST_ID,
        userId: TEST_ADMIN_ID,
        role: 'owner',
        createdAt: new Date(),
      },
      {
        id: MBR_TEST_STAFF,
        organizationId: TEST_ID,
        userId: TEST_STAFF_ID,
        role: 'member',
        createdAt: new Date(),
      },
      {
        id: MBR_TEST_PARTICIPANT,
        organizationId: TEST_ID,
        userId: TEST_PARTICIPANT_ID,
        role: 'member',
        createdAt: new Date(),
      },
    ])
    .onConflictDoNothing();
  console.log('  ✓ members');

  // ── Seed one event per tenant (useful for isolation smoke tests) ───────────
  const PAT_EVENT_ID = '00000000-0000-4000-d000-000000000001';
  const TEST_EVENT_ID = '00000000-0000-4000-d000-000000000002';

  await db
    .insert(schema.events)
    .values([
      {
        id: PAT_EVENT_ID,
        tenantId: PAT_ID,
        name: 'PAT Trail Run 2026',
        startsAt: new Date('2026-09-01T06:00:00+08:00'),
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: TEST_EVENT_ID,
        tenantId: TEST_ID,
        name: 'Test Tenant Event',
        startsAt: new Date('2026-10-01T06:00:00+08:00'),
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    .onConflictDoNothing();
  console.log('  ✓ events');

  console.log('🌱  Seed complete.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
