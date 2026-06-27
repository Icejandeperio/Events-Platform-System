/**
 * Two-tenant isolation test — the first test that must exist for every new
 * data-access path (SECURITY.md §1, ARCHITECTURE.md §4, ADR 0001).
 *
 * Verifies that RLS policies prevent tenant A from reading, listing, updating,
 * or deleting tenant B's rows through the application-role DB connection.
 *
 * Requires: `npm run db:up && npm run db:migrate` before running.
 * Set DATABASE_URL (superuser, for setup/teardown) and
 *     APP_DATABASE_URL (tenantkit_app role, for RLS-enforced queries).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '../schema';

const DB_URL = process.env['DATABASE_URL'];
const APP_URL = process.env['APP_DATABASE_URL'];

// In CI, silently skipping would mask a misconfigured runner — fail loudly instead.
if (process.env['CI'] && (!DB_URL || !APP_URL)) {
  throw new Error(
    [
      'Isolation test cannot be skipped in CI — missing required env vars:',
      !DB_URL ? '  DATABASE_URL (superuser connection for setup/teardown)' : '',
      !APP_URL ? '  APP_DATABASE_URL (app-role connection for RLS assertions)' : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

// ── Skip gracefully when DB is not available (local dev only) ─────────────────
describe.skipIf(!DB_URL || !APP_URL)('two-tenant isolation (RLS)', () => {
  // Test-local tenant + event IDs — chosen to avoid colliding with seed data.
  const TENANT_A = 'aaaaaaaa-0000-4000-a000-000000000001';
  const TENANT_B = 'bbbbbbbb-0000-4000-b000-000000000001';
  const EVENT_A = 'aaaaaaaa-0000-4000-e000-000000000001';
  const EVENT_B = 'bbbbbbbb-0000-4000-e000-000000000001';

  // superuser connection — bypasses RLS, used for setup/teardown only
  let superSql: ReturnType<typeof postgres>;
  let superDb: ReturnType<typeof drizzle<typeof schema>>;
  // app-role connection — subject to RLS, used for the actual assertions
  let appSql: ReturnType<typeof postgres>;
  let appDb: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    // describe.skipIf already skips the suite when URLs are absent;
    // this guard narrows the types so no non-null assertions are needed.
    if (!DB_URL || !APP_URL) return;
    superSql = postgres(DB_URL);
    superDb = drizzle(superSql, { schema });
    appSql = postgres(APP_URL);
    appDb = drizzle(appSql, { schema });

    // Insert two tenant orgs + one event each (bypasses RLS as superuser).
    await superDb
      .insert(schema.organization)
      .values([
        {
          id: TENANT_A,
          name: 'Isolation Test Tenant A',
          slug: 'iso-tenant-a',
          createdAt: new Date(),
        },
        {
          id: TENANT_B,
          name: 'Isolation Test Tenant B',
          slug: 'iso-tenant-b',
          createdAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    await superDb
      .insert(schema.events)
      .values([
        {
          id: EVENT_A,
          tenantId: TENANT_A,
          name: 'Tenant A Event',
          startsAt: new Date('2026-12-01T06:00:00Z'),
          status: 'open',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: EVENT_B,
          tenantId: TENANT_B,
          name: 'Tenant B Event',
          startsAt: new Date('2026-12-01T06:00:00Z'),
          status: 'open',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    // Cleanup via superuser (bypasses RLS) — delete in FK-safe order.
    await superDb
      .delete(schema.events)
      .where(sql`tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`);
    await superDb
      .delete(schema.organization)
      .where(sql`id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`);
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

  // ── SELECT isolation ──────────────────────────────────────────────────────

  it('tenant A sees only its own events via SELECT', async () => {
    const rows = await asAppTenant(TENANT_A, (tx) => tx.select().from(schema.events));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(EVENT_A);
    expect(ids).not.toContain(EVENT_B);
  });

  it('tenant B sees only its own events via SELECT', async () => {
    const rows = await asAppTenant(TENANT_B, (tx) => tx.select().from(schema.events));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(EVENT_B);
    expect(ids).not.toContain(EVENT_A);
  });

  it('tenant A cannot read tenant B event by ID', async () => {
    const rows = await asAppTenant(TENANT_A, (tx) =>
      tx
        .select()
        .from(schema.events)
        .where(sql`id = ${EVENT_B}::uuid`),
    );
    expect(rows).toHaveLength(0);
  });

  // ── UPDATE isolation ──────────────────────────────────────────────────────

  it('tenant A cannot update tenant B event', async () => {
    await asAppTenant(TENANT_A, async (tx) => {
      const result = await tx
        .update(schema.events)
        .set({ name: 'Hijacked by Tenant A' })
        .where(sql`id = ${EVENT_B}::uuid`)
        .returning();
      // RLS WITH CHECK blocks the update — zero rows affected.
      expect(result).toHaveLength(0);
    });

    // Verify name is unchanged (read as superuser to bypass RLS).
    const [unchanged] = await superDb
      .select({ name: schema.events.name })
      .from(schema.events)
      .where(sql`id = ${EVENT_B}::uuid`);
    expect(unchanged?.name).toBe('Tenant B Event');
  });

  // ── DELETE isolation ──────────────────────────────────────────────────────

  it('tenant A cannot delete tenant B event', async () => {
    await asAppTenant(TENANT_A, async (tx) => {
      const result = await tx
        .delete(schema.events)
        .where(sql`id = ${EVENT_B}::uuid`)
        .returning();
      // RLS USING blocks the delete — zero rows affected.
      expect(result).toHaveLength(0);
    });

    // Verify the row still exists (superuser read).
    const rows = await superDb
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(sql`id = ${EVENT_B}::uuid`);
    expect(rows).toHaveLength(1);
  });

  // ── INSERT isolation (WITH CHECK) ─────────────────────────────────────────

  it('tenant A cannot INSERT an event into tenant B (WITH CHECK)', async () => {
    await expect(
      asAppTenant(TENANT_A, async (tx) => {
        await tx.insert(schema.events).values({
          id: crypto.randomUUID(),
          tenantId: TENANT_B, // cross-tenant write attempt
          name: 'Injected by Tenant A',
          startsAt: new Date(),
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
    ).rejects.toThrow(); // RLS WITH CHECK rejects cross-tenant inserts
  });
});
