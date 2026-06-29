/**
 * BOLA (Broken Object Level Authorization) raw RLS proof — Milestone 3b gate.
 *
 * @remarks
 * Requirement (SECURITY.md §1, ARCHITECTURE.md §4):
 * Connected as the `tenantkit_app` role (NOBYPASSRLS) with tenant A's context
 * set via `app.current_tenant`, a direct SQL query for a known tenant B row
 * MUST return 0 rows for every entity type that carries `tenant_id`.
 *
 * This test proves that the **database itself** denies cross-tenant access —
 * not that the repository hand-filters by tenant_id (which would only prove the
 * application layer is working, not the RLS backstop).
 *
 * Requires: `npm run db:up && npm run db:migrate` before running locally.
 * Set DATABASE_URL (superuser, for setup/teardown) and
 *     APP_DATABASE_URL (tenantkit_app role, for the RLS assertions).
 * In CI both env vars are always set — the CI-throws guard enforces this.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq } from 'drizzle-orm';
import { TenantId } from '@domain/value-objects/tenant-id';
import { DrizzleEventRepository } from '@infrastructure/events/drizzle-event-repository';
import { DrizzleRegistrationRepository } from '@infrastructure/registration/drizzle-registration-repository';
import { DrizzlePaymentRepository } from '@infrastructure/payment/drizzle-payment-repository';
import * as schema from '../schema';

const DB_URL = process.env['DATABASE_URL'];
const APP_URL = process.env['APP_DATABASE_URL'];

// In CI, silently skipping would mask a misconfigured runner — fail loudly instead.
if (process.env['CI'] && (!DB_URL || !APP_URL)) {
  throw new Error(
    [
      'BOLA integration test cannot be skipped in CI — missing required env vars:',
      !DB_URL ? '  DATABASE_URL (superuser connection for setup/teardown)' : '',
      !APP_URL ? '  APP_DATABASE_URL (app-role connection for RLS assertions)' : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────
// Distinct from the tenant-isolation test IDs to avoid inter-test collisions.
const BOLA_TENANT_A = 'aaaaaaaa-0000-4000-a000-000000000010';
const BOLA_TENANT_B = 'bbbbbbbb-0000-4000-b000-000000000010';
const BOLA_EVENT_B = 'eeeeeeee-0000-4000-b000-000000000010';
const BOLA_PARTICIPANT_B = 'dddddddd-0000-4000-b000-000000000010';
const BOLA_REGISTRATION_B = 'cccccccc-0000-4000-b000-000000000010';
const BOLA_PAYMENT_B = 'ffffffff-0000-4000-b000-000000000010';

describe.skipIf(!DB_URL || !APP_URL)('BOLA — raw RLS proof', () => {
  // Superuser connection — bypasses RLS, used for setup/teardown only.
  let superSql: ReturnType<typeof postgres>;
  let superDb: ReturnType<typeof drizzle<typeof schema>>;
  // App-role connection — subject to RLS (NOBYPASSRLS), used for assertions.
  let appSql: ReturnType<typeof postgres>;
  let appDb: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    if (!DB_URL || !APP_URL) return;
    superSql = postgres(DB_URL);
    superDb = drizzle(superSql, { schema });
    appSql = postgres(APP_URL);
    appDb = drizzle(appSql, { schema });

    // Insert two tenant orgs via superuser (bypasses RLS).
    await superDb
      .insert(schema.organization)
      .values([
        {
          id: BOLA_TENANT_A,
          name: 'BOLA Test Tenant A',
          slug: 'bola-tenant-a',
          createdAt: new Date(),
        },
        {
          id: BOLA_TENANT_B,
          name: 'BOLA Test Tenant B',
          slug: 'bola-tenant-b',
          createdAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    // Insert tenant B's event (FK: tenant_id → organization.id).
    await superDb
      .insert(schema.events)
      .values({
        id: BOLA_EVENT_B,
        tenantId: BOLA_TENANT_B,
        name: 'BOLA Tenant B Event',
        startsAt: new Date('2026-12-01T06:00:00Z'),
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Insert tenant B's participant (FK: tenant_id → organization.id).
    await superDb
      .insert(schema.participants)
      .values({
        id: BOLA_PARTICIPANT_B,
        tenantId: BOLA_TENANT_B,
        firstName: 'BOLA',
        lastName: 'TestUser',
        email: 'bola-test@tenant-b.test',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Insert tenant B's registration (FK: participant_id, event_id, tenant_id).
    await superDb
      .insert(schema.registrations)
      .values({
        id: BOLA_REGISTRATION_B,
        tenantId: BOLA_TENANT_B,
        participantId: BOLA_PARTICIPANT_B,
        eventId: BOLA_EVENT_B,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Insert tenant B's payment (FK: registration_id, tenant_id).
    await superDb
      .insert(schema.payments)
      .values({
        id: BOLA_PAYMENT_B,
        tenantId: BOLA_TENANT_B,
        registrationId: BOLA_REGISTRATION_B,
        amount: 50000,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (!DB_URL || !APP_URL) return;
    // Delete in FK-safe order (payments → registrations → participants → events → orgs).
    await superDb.delete(schema.payments).where(sql`tenant_id IN (${BOLA_TENANT_B}::uuid)`);
    await superDb.delete(schema.registrations).where(sql`tenant_id IN (${BOLA_TENANT_B}::uuid)`);
    await superDb.delete(schema.participants).where(sql`tenant_id IN (${BOLA_TENANT_B}::uuid)`);
    await superDb.delete(schema.events).where(sql`tenant_id IN (${BOLA_TENANT_B}::uuid)`);
    await superDb
      .delete(schema.organization)
      .where(sql`id IN (${BOLA_TENANT_A}::uuid, ${BOLA_TENANT_B}::uuid)`);
    await superSql.end();
    await appSql.end();
  });

  /**
   * Runs a query as the app role with tenant context set.
   *
   * @param tenantId - UUID of the tenant to scope the query to.
   * @param fn - Callback receiving the RLS-scoped transaction.
   * @returns The return value of `fn`.
   */
  async function asAppTenant<T>(
    tenantId: string,
    fn: (tx: Parameters<Parameters<typeof appDb.transaction>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return appDb.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  // ── Raw SQL BOLA proofs ────────────────────────────────────────────────────
  // These queries bypass the repository adapter entirely — they prove the DB
  // itself denies cross-tenant access regardless of application-layer filtering.

  describe('participants table', () => {
    it('[raw SQL] tenant A cannot read tenant B participant by ID', async () => {
      const rows = await asAppTenant(BOLA_TENANT_A, (tx) =>
        tx.select().from(schema.participants).where(eq(schema.participants.id, BOLA_PARTICIPANT_B)),
      );
      expect(rows).toHaveLength(0);
    });

    it('[raw SQL] tenant A cannot list any tenant B participants', async () => {
      const rows = await asAppTenant(BOLA_TENANT_A, (tx) =>
        tx
          .select()
          .from(schema.participants)
          .where(sql`email = ${'bola-test@tenant-b.test'}`),
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('registrations table', () => {
    it('[raw SQL] tenant A cannot read tenant B registration by ID', async () => {
      const rows = await asAppTenant(BOLA_TENANT_A, (tx) =>
        tx
          .select()
          .from(schema.registrations)
          .where(eq(schema.registrations.id, BOLA_REGISTRATION_B)),
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('payments table', () => {
    it('[raw SQL] tenant A cannot read tenant B payment by ID', async () => {
      const rows = await asAppTenant(BOLA_TENANT_A, (tx) =>
        tx.select().from(schema.payments).where(eq(schema.payments.id, BOLA_PAYMENT_B)),
      );
      expect(rows).toHaveLength(0);
    });
  });

  // ── Write-path BOLA proofs ────────────────────────────────────────────────
  // RLS WITH CHECK blocks cross-tenant writes at the DB layer.
  // UPDATE/DELETE: USING clause hides tenant B rows → 0 rows affected.
  // INSERT: WITH CHECK fires on mismatched tenant_id → throws.
  // Superuser re-reads confirm the DB state is actually unchanged.

  describe('write-path (registrations table)', () => {
    it('[raw SQL] tenant A cannot UPDATE tenant B registration (0 rows affected, row unchanged)', async () => {
      const affected = await asAppTenant(BOLA_TENANT_A, (tx) =>
        tx
          .update(schema.registrations)
          .set({ status: 'cancelled' })
          .where(eq(schema.registrations.id, BOLA_REGISTRATION_B))
          .returning(),
      );
      expect(affected).toHaveLength(0);

      // Superuser re-read confirms the row was not mutated.
      const [row] = await superDb
        .select()
        .from(schema.registrations)
        .where(eq(schema.registrations.id, BOLA_REGISTRATION_B));
      expect(row?.status).toBe('pending');
    });

    it('[raw SQL] tenant A cannot DELETE tenant B registration (0 rows affected, row still exists)', async () => {
      const deleted = await asAppTenant(BOLA_TENANT_A, (tx) =>
        tx
          .delete(schema.registrations)
          .where(eq(schema.registrations.id, BOLA_REGISTRATION_B))
          .returning(),
      );
      expect(deleted).toHaveLength(0);

      // Superuser re-read confirms the row still exists.
      const [row] = await superDb
        .select()
        .from(schema.registrations)
        .where(eq(schema.registrations.id, BOLA_REGISTRATION_B));
      expect(row).toBeDefined();
    });

    it('[raw SQL] tenant A cannot INSERT a registration with tenant B tenant_id (WITH CHECK violation)', async () => {
      await expect(
        asAppTenant(BOLA_TENANT_A, (tx) =>
          tx.insert(schema.registrations).values({
            id: crypto.randomUUID(),
            tenantId: BOLA_TENANT_B,
            participantId: BOLA_PARTICIPANT_B,
            eventId: BOLA_EVENT_B,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('write-path (payments table)', () => {
    it('[raw SQL] tenant A cannot UPDATE tenant B payment (0 rows affected, row unchanged)', async () => {
      const affected = await asAppTenant(BOLA_TENANT_A, (tx) =>
        tx
          .update(schema.payments)
          .set({ status: 'CONFIRMED' })
          .where(eq(schema.payments.id, BOLA_PAYMENT_B))
          .returning(),
      );
      expect(affected).toHaveLength(0);

      // Superuser re-read confirms the row was not mutated.
      const [row] = await superDb
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, BOLA_PAYMENT_B));
      expect(row?.status).toBe('PENDING');
    });

    it('[raw SQL] tenant A cannot DELETE tenant B payment (0 rows affected, row still exists)', async () => {
      const deleted = await asAppTenant(BOLA_TENANT_A, (tx) =>
        tx.delete(schema.payments).where(eq(schema.payments.id, BOLA_PAYMENT_B)).returning(),
      );
      expect(deleted).toHaveLength(0);

      // Superuser re-read confirms the row still exists.
      const [row] = await superDb
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, BOLA_PAYMENT_B));
      expect(row).toBeDefined();
    });

    it('[raw SQL] tenant A cannot INSERT a payment with tenant B tenant_id (WITH CHECK violation)', async () => {
      await expect(
        asAppTenant(BOLA_TENANT_A, (tx) =>
          tx.insert(schema.payments).values({
            id: crypto.randomUUID(),
            tenantId: BOLA_TENANT_B,
            registrationId: BOLA_REGISTRATION_B,
            amount: 100,
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      ).rejects.toThrow();
    });
  });

  // ── Adapter-level BOLA proofs ─────────────────────────────────────────────
  // These verify the Drizzle adapters return NotFoundError (not a data leak)
  // when a cross-tenant lookup reaches the DB. The raw SQL proofs above are
  // the definitive gate; these are defense-in-depth verification.

  describe('DrizzleRegistrationRepository', () => {
    it('[adapter] findById returns NotFoundError for a cross-tenant registration', async () => {
      const tenantA = TenantId.create(BOLA_TENANT_A);
      if (!tenantA.ok) throw new Error('Bad fixture TenantId');
      const repo = new DrizzleRegistrationRepository(appDb);

      const result = await repo.findById(BOLA_REGISTRATION_B, tenantA.value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Registration/);
    });
  });

  describe('DrizzlePaymentRepository', () => {
    it('[adapter] findById returns NotFoundError for a cross-tenant payment', async () => {
      const tenantA = TenantId.create(BOLA_TENANT_A);
      if (!tenantA.ok) throw new Error('Bad fixture TenantId');
      const repo = new DrizzlePaymentRepository(appDb);

      const result = await repo.findById(BOLA_PAYMENT_B, tenantA.value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Payment/);
    });
  });

  describe('DrizzleEventRepository', () => {
    it('[adapter] findById returns NotFoundError for a cross-tenant event', async () => {
      const tenantA = TenantId.create(BOLA_TENANT_A);
      if (!tenantA.ok) throw new Error('Bad fixture TenantId');
      const repo = new DrizzleEventRepository(appDb);

      const result = await repo.findById(BOLA_EVENT_B, tenantA.value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Event/);
    });
  });
});
