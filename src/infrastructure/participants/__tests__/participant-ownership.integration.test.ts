/**
 * Same-tenant participant ownership (BOLA) — Milestone 3d-b gate.
 *
 * @remarks
 * RLS enforces cross-TENANT isolation but provides NO backstop for same-tenant
 * cross-PARTICIPANT access. This test proves the application-layer ownership
 * check on the ROUTE HANDLERS is the only defense, and that it holds.
 *
 * **Four mandatory BOLA directions tested at the HTTP boundary** (all must pass in CI):
 *   1. Serve — participant A denied fetching B's proof (403).
 *   2. Serve — participant A CAN fetch their own proof (200).
 *   3. Upload — participant A denied submitting on B's payment (404 — existence not leaked).
 *   4. Upload — participant A CAN submit on their own payment (201).
 *
 * Additionally tests the deny-by-default gate for unlinked users (user_id IS NULL)
 * on both routes, and the underlying `DrizzleParticipantRepository.findByUserId`
 * unit paths including the null-comparison trap guard.
 *
 * **Approach**: `requireRole` is stubbed to inject a known session identity.
 * Everything downstream — `findByUserId`, the ownership traversal, the full
 * route handler body — executes as the real code path against a live DB.
 * File storage is an in-memory fake seeded with a valid JPEG proof for the 200 case.
 *
 * Requires: `npm run db:up && npm run db:migrate` before running locally.
 * Set DATABASE_URL (superuser, for setup/teardown) and
 *     APP_DATABASE_URL (app-role, NOBYPASSRLS, for all repo/route assertions).
 * In CI both env vars are always set — the CI-throws guard enforces this.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { TenantId } from '@domain/value-objects/tenant-id';
import { DrizzleParticipantRepository } from '@infrastructure/participants/drizzle-participant-repository';
import { DrizzlePaymentRepository } from '@infrastructure/payment/drizzle-payment-repository';
import { DrizzleRegistrationRepository } from '@infrastructure/registration/drizzle-registration-repository';
import { InMemoryFileStorage } from '@infrastructure/storage/fakes/in-memory-file-storage';
import { InMemoryEventRepository } from '@infrastructure/events/fakes/in-memory-event-repository';
import { InMemoryConsentRepository } from '@infrastructure/consent/fakes/in-memory-consent-repository';
import { InMemoryAuditLog } from '@infrastructure/audit/fakes/in-memory-audit-log';
import { FakePaymentProvider } from '@infrastructure/payment-provider/fakes/fake-payment-provider';
import { FakeNotifier } from '@infrastructure/notifications/fakes/fake-notifier';
import { StubClock } from '@infrastructure/clock/fakes/stub-clock';
import { CryptoIdAdapter } from '@infrastructure/id/crypto-id';
import * as schema from '@infrastructure/db/schema';
import type { AppDependencies } from '../../../app/_bootstrap/bootstrap';

// ── Module mocks (hoisted before any import by Vitest's transformer) ────────
// requireRole is stubbed per-test to inject specific session identities.
// getAppDependencies is stubbed once in beforeAll to supply real Drizzle repos
// wired to the integration test DB, plus an in-memory file store.
vi.mock('@infrastructure/auth/require-role', () => ({
  requireRole: vi.fn(),
}));
vi.mock('../../../app/_bootstrap/bootstrap', () => ({
  getAppDependencies: vi.fn(),
}));

// Import mocked versions so we can configure them.
// These dynamic imports MUST come after vi.mock() calls.
import { requireRole } from '@infrastructure/auth/require-role';
import { getAppDependencies } from '../../../app/_bootstrap/bootstrap';

// Import the actual route handlers under test.
// Mocks above intercept their dependencies without touching this import.
import { POST as uploadProof } from '../../../app/api/payments/[paymentId]/proof/route';
import { GET as serveProof } from '../../../app/api/payments/[paymentId]/proof/serve/route';

const DB_URL = process.env['DATABASE_URL'];
const APP_URL = process.env['APP_DATABASE_URL'];

// In CI, silently skipping would mask a misconfigured runner — fail loudly instead.
if (process.env['CI'] && (!DB_URL || !APP_URL)) {
  throw new Error(
    [
      'Participant ownership BOLA test cannot be skipped in CI — missing required env vars:',
      !DB_URL ? '  DATABASE_URL (superuser connection for setup/teardown)' : '',
      !APP_URL ? '  APP_DATABASE_URL (app-role connection for route and repo assertions)' : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

// ── Fixture constants ─────────────────────────────────────────────────────────
// All IDs are scoped to the same tenant — same-tenant cross-participant isolation.
// All UUIDs use valid hex digits only (0-9, a-f).

const OWN_TENANT = 'cccccccc-0001-4000-a000-000000000020';
const USER_A_ID = 'user-own-a-001'; // text PK on user table (not uuid)
const USER_B_ID = 'user-own-b-001';
const PARTICIPANT_A = 'aaaaaaaa-0001-4000-a000-000000000020';
const PARTICIPANT_B = 'bbbbbbbb-0001-4000-a000-000000000020';
const PARTICIPANT_UNLINKED = '44444444-0001-4000-a000-000000000020';
const EVENT_ID = 'eeeeeeee-0001-4000-a000-000000000020';
const REGISTRATION_A = '55555555-0001-4000-a000-000000000020';
const REGISTRATION_B = '55555555-0001-4000-b000-000000000020';
// PAYMENT_A_PENDING: for upload-own-201 test. Must be in PENDING state before each upload test.
const PAYMENT_A_PENDING = 'ffffffff-0001-4000-a000-000000000020';
// PAYMENT_A_SUBMITTED: for serve-own-200 test. Has proofUrl matching PROOF_KEY_A in fileStorage.
const PAYMENT_A_SUBMITTED = 'aaaaaaaa-0001-4000-c000-000000000020';
// PAYMENT_B_PENDING: for upload-cross-participant-deny test. Owned by PARTICIPANT_B.
const PAYMENT_B_PENDING = 'bbbbbbbb-0001-4000-c000-000000000020';
// PAYMENT_B_SUBMITTED: for serve-cross-participant-deny test. Has a proofUrl.
const PAYMENT_B_SUBMITTED = 'ffffffff-0001-4000-b000-000000000020';

// Storage key for participant A's submitted proof (seeded in InMemoryFileStorage).
const PROOF_KEY_A = 'test-proofs/proof-a-submitted.jpg';
const PROOF_KEY_B = 'test-proofs/proof-b-submitted.jpg';

// Minimal valid JPEG: FF D8 FF + padding (passes detectMimeType on both upload and serve).
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

describe.skipIf(!DB_URL || !APP_URL)('Same-tenant participant ownership — BOLA', () => {
  // Superuser — bypasses RLS, for setup/teardown.
  let superSql: ReturnType<typeof postgres>;
  let superDb: ReturnType<typeof drizzle<typeof schema>>;
  // App role — NOBYPASSRLS, for all repository and route assertions.
  let appSql: ReturnType<typeof postgres>;
  let appDb: ReturnType<typeof drizzle<typeof schema>>;

  let fileStorage: InMemoryFileStorage;

  beforeAll(async () => {
    if (!DB_URL || !APP_URL) return;
    superSql = postgres(DB_URL);
    superDb = drizzle(superSql, { schema });
    appSql = postgres(APP_URL);
    appDb = drizzle(appSql, { schema });

    // ── Seed DB fixtures ──────────────────────────────────────────────────────

    await superDb
      .insert(schema.organization)
      .values({
        id: OWN_TENANT,
        name: 'Ownership Test Tenant',
        slug: 'ownership-test-tenant',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    // User rows required by participants.user_id FK (participants.user_id → user.id).
    await superDb
      .insert(schema.user)
      .values([
        {
          id: USER_A_ID,
          name: 'User A',
          email: 'user-a@ownership-test.test',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: USER_B_ID,
          name: 'User B',
          email: 'user-b@ownership-test.test',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    await superDb
      .insert(schema.events)
      .values({
        id: EVENT_ID,
        tenantId: OWN_TENANT,
        name: 'Ownership Test Event',
        startsAt: new Date('2026-12-01T06:00:00Z'),
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Participant A and B are linked to real user rows; UNLINKED has user_id = null.
    await superDb
      .insert(schema.participants)
      .values([
        {
          id: PARTICIPANT_A,
          tenantId: OWN_TENANT,
          userId: USER_A_ID,
          firstName: 'Owner',
          lastName: 'A',
          email: 'participant-a@ownership-test.test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: PARTICIPANT_B,
          tenantId: OWN_TENANT,
          userId: USER_B_ID,
          firstName: 'Owner',
          lastName: 'B',
          email: 'participant-b@ownership-test.test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: PARTICIPANT_UNLINKED,
          tenantId: OWN_TENANT,
          userId: null,
          firstName: 'Unlinked',
          lastName: 'Guest',
          email: 'unlinked@ownership-test.test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    await superDb
      .insert(schema.registrations)
      .values([
        {
          id: REGISTRATION_A,
          tenantId: OWN_TENANT,
          participantId: PARTICIPANT_A,
          eventId: EVENT_ID,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: REGISTRATION_B,
          tenantId: OWN_TENANT,
          participantId: PARTICIPANT_B,
          eventId: EVENT_ID,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    // PAYMENT_A_PENDING: for upload-own-201. Reset to PENDING before each upload test.
    await superDb
      .insert(schema.payments)
      .values({
        id: PAYMENT_A_PENDING,
        tenantId: OWN_TENANT,
        registrationId: REGISTRATION_A,
        amount: 50000,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // PAYMENT_A_SUBMITTED: for serve-own-200. Has proofUrl matching PROOF_KEY_A.
    await superDb
      .insert(schema.payments)
      .values({
        id: PAYMENT_A_SUBMITTED,
        tenantId: OWN_TENANT,
        registrationId: REGISTRATION_A,
        amount: 50000,
        status: 'SUBMITTED',
        proofUrl: PROOF_KEY_A,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // PAYMENT_B_PENDING: for upload-cross-403. Owned by participant B.
    await superDb
      .insert(schema.payments)
      .values({
        id: PAYMENT_B_PENDING,
        tenantId: OWN_TENANT,
        registrationId: REGISTRATION_B,
        amount: 50000,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // PAYMENT_B_SUBMITTED: for serve-cross-403. Has proofUrl.
    await superDb
      .insert(schema.payments)
      .values({
        id: PAYMENT_B_SUBMITTED,
        tenantId: OWN_TENANT,
        registrationId: REGISTRATION_B,
        amount: 50000,
        status: 'SUBMITTED',
        proofUrl: PROOF_KEY_B,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // ── Configure the getAppDependencies mock ─────────────────────────────────
    // Real Drizzle repos for the three fields the routes touch; light fakes elsewhere.
    fileStorage = new InMemoryFileStorage();
    // Pre-seed PROOF_KEY_A so the serve-own-200 test can retrieve it.
    await fileStorage.store(PROOF_KEY_A, {
      buffer: JPEG_BYTES,
      mimeType: 'image/jpeg',
      originalName: 'proof-a.jpg',
      sizeBytes: JPEG_BYTES.length,
    });

    const testDeps: AppDependencies = {
      participantRepository: new DrizzleParticipantRepository(appDb),
      paymentRepository: new DrizzlePaymentRepository(appDb),
      registrationRepository: new DrizzleRegistrationRepository(appDb),
      fileStorage,
      eventRepository: new InMemoryEventRepository(),
      consentRepository: new InMemoryConsentRepository(),
      auditLog: new InMemoryAuditLog(),
      paymentProvider: new FakePaymentProvider(),
      notifier: new FakeNotifier(),
      clock: new StubClock(new Date('2026-07-03T00:00:00Z')),
      idProvider: new CryptoIdAdapter(),
    };
    vi.mocked(getAppDependencies).mockReturnValue(testDeps);
  });

  afterAll(async () => {
    if (!DB_URL || !APP_URL) return;
    // Delete in FK-safe order. `sql\`` template avoids Drizzle UUID casting on plain text.
    await superDb.delete(schema.payments).where(sql`tenant_id = ${OWN_TENANT}::uuid`);
    await superDb.delete(schema.registrations).where(sql`tenant_id = ${OWN_TENANT}::uuid`);
    await superDb.delete(schema.participants).where(sql`tenant_id = ${OWN_TENANT}::uuid`);
    await superDb.delete(schema.events).where(sql`tenant_id = ${OWN_TENANT}::uuid`);
    await superDb.delete(schema.organization).where(eq(schema.organization.id, OWN_TENANT));
    await superDb.delete(schema.user).where(sql`id IN (${USER_A_ID}, ${USER_B_ID})`);
    await superSql.end();
    await appSql.end();
  });

  // ── Route-level BOLA: serve path ─────────────────────────────────────────
  // GET /api/payments/[paymentId]/proof/serve
  // Ownership check: session.user.id → participant → registration.participantId
  // must match the payment's registration's participantId.

  describe('serve route (GET /proof/serve)', () => {
    it("[BOLA direction 1] user A denied B's proof — 403", async () => {
      // User A's session — resolved to PARTICIPANT_A.
      vi.mocked(requireRole).mockResolvedValueOnce({
        ok: true,
        ctx: { userId: USER_A_ID, tenantId: OWN_TENANT, role: 'member' },
      });

      // PAYMENT_B_SUBMITTED.registrationId = REGISTRATION_B → participantId = PARTICIPANT_B ≠ PARTICIPANT_A.
      const req = new NextRequest(
        `http://localhost:3000/api/payments/${PAYMENT_B_SUBMITTED}/proof/serve`,
      );
      const res = await serveProof(req, {
        params: Promise.resolve({ paymentId: PAYMENT_B_SUBMITTED }),
      });

      expect(res.status).toBe(403);
    });

    it('[BOLA direction 2] user A fetches own proof — 200', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({
        ok: true,
        ctx: { userId: USER_A_ID, tenantId: OWN_TENANT, role: 'member' },
      });

      // PAYMENT_A_SUBMITTED.registrationId = REGISTRATION_A → participantId = PARTICIPANT_A = session participant.
      const req = new NextRequest(
        `http://localhost:3000/api/payments/${PAYMENT_A_SUBMITTED}/proof/serve`,
      );
      const res = await serveProof(req, {
        params: Promise.resolve({ paymentId: PAYMENT_A_SUBMITTED }),
      });

      expect(res.status).toBe(200);
      // Confirm JPEG content type derived from magic bytes (not from stored metadata).
      expect(res.headers.get('Content-Type')).toBe('image/jpeg');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('unlinked user (user_id IS NULL) denied on serve — 403', async () => {
      // Session for a user with no linked participant record.
      vi.mocked(requireRole).mockResolvedValueOnce({
        ok: true,
        ctx: { userId: 'user-with-no-participant', tenantId: OWN_TENANT, role: 'member' },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/payments/${PAYMENT_A_SUBMITTED}/proof/serve`,
      );
      const res = await serveProof(req, {
        params: Promise.resolve({ paymentId: PAYMENT_A_SUBMITTED }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── Route-level BOLA: upload path ─────────────────────────────────────────
  // POST /api/payments/[paymentId]/proof
  // Participant is derived from session only — body participantId was removed.
  // Cross-participant deny returns 404 (NotFoundError from SubmitPaymentProof) to
  // avoid leaking whether the payment exists (SECURITY.md §1).

  describe('upload route (POST /proof)', () => {
    beforeEach(async () => {
      // Reset PAYMENT_A_PENDING to PENDING so the 201 test is idempotent across runs.
      await superDb
        .update(schema.payments)
        .set({ status: 'PENDING', proofUrl: null, updatedAt: new Date() })
        .where(eq(schema.payments.id, PAYMENT_A_PENDING));
    });

    /**
     * Builds a multipart POST request with a minimal valid JPEG proof file.
     * The file bytes pass `detectMimeType` without a live file on disk.
     *
     * @param paymentId - The payment UUID to target in the route URL.
     * @returns A `NextRequest` with a multipart body containing the proof file.
     */
    function makeUploadRequest(paymentId: string): NextRequest {
      const form = new FormData();
      form.append('file', new File([JPEG_BYTES], 'proof.jpg', { type: 'image/jpeg' }));
      return new NextRequest(`http://localhost:3000/api/payments/${paymentId}/proof`, {
        method: 'POST',
        body: form,
      });
    }

    it("[BOLA direction 3] user A denied uploading to B's payment — 404 (existence not leaked)", async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({
        ok: true,
        ctx: { userId: USER_A_ID, tenantId: OWN_TENANT, role: 'member' },
      });

      // PAYMENT_B_PENDING.registrationId = REGISTRATION_B → participantId = PARTICIPANT_B ≠ PARTICIPANT_A.
      // SubmitPaymentProof returns NotFoundError (not UnauthorizedError) to avoid leaking existence.
      const req = makeUploadRequest(PAYMENT_B_PENDING);
      const res = await uploadProof(req, {
        params: Promise.resolve({ paymentId: PAYMENT_B_PENDING }),
      });

      expect(res.status).toBe(404);
    });

    it('[BOLA direction 4] user A uploads to own payment — 201', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({
        ok: true,
        ctx: { userId: USER_A_ID, tenantId: OWN_TENANT, role: 'member' },
      });

      // PAYMENT_A_PENDING.registrationId = REGISTRATION_A → participantId = PARTICIPANT_A = session participant.
      const req = makeUploadRequest(PAYMENT_A_PENDING);
      const res = await uploadProof(req, {
        params: Promise.resolve({ paymentId: PAYMENT_A_PENDING }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('SUBMITTED');
    });

    it('unlinked user (user_id IS NULL) denied on upload — 403', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({
        ok: true,
        ctx: { userId: 'user-with-no-participant', tenantId: OWN_TENANT, role: 'member' },
      });

      const req = makeUploadRequest(PAYMENT_A_PENDING);
      const res = await uploadProof(req, {
        params: Promise.resolve({ paymentId: PAYMENT_A_PENDING }),
      });

      // findByUserId returns null → route returns 403 before reaching the use case.
      expect(res.status).toBe(403);
    });
  });

  // ── DrizzleParticipantRepository.findByUserId ─────────────────────────────
  // These repository-level tests are kept as defense in depth — they isolate the
  // lookup logic from the route handler. The route-level tests above are the
  // primary BOLA gate; these prove the building block is correct independently.

  describe('DrizzleParticipantRepository.findByUserId', () => {
    it('returns the correct participant for a linked user', async () => {
      const tenantIdResult = TenantId.create(OWN_TENANT);
      if (!tenantIdResult.ok) throw new Error('Bad fixture TenantId');
      const repo = new DrizzleParticipantRepository(appDb);

      const result = await repo.findByUserId(USER_A_ID, tenantIdResult.value);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value?.id).toBe(PARTICIPANT_A);
    });

    it('returns null for a userId with no linked participant', async () => {
      const tenantIdResult = TenantId.create(OWN_TENANT);
      if (!tenantIdResult.ok) throw new Error('Bad fixture TenantId');
      const repo = new DrizzleParticipantRepository(appDb);

      const result = await repo.findByUserId('no-such-user-id', tenantIdResult.value);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBeNull();
    });

    it('null-comparison guard: empty string userId returns null without hitting DB', async () => {
      const tenantIdResult = TenantId.create(OWN_TENANT);
      if (!tenantIdResult.ok) throw new Error('Bad fixture TenantId');
      const repo = new DrizzleParticipantRepository(appDb);

      // Empty string is falsy — must short-circuit before touching the DB.
      const result = await repo.findByUserId('', tenantIdResult.value);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBeNull();
    });

    it('a participant with user_id IS NULL is never returned for any non-empty userId lookup', async () => {
      const tenantIdResult = TenantId.create(OWN_TENANT);
      if (!tenantIdResult.ok) throw new Error('Bad fixture TenantId');
      const repo = new DrizzleParticipantRepository(appDb);

      // Any user ID that has no linked participant must not accidentally match
      // the PARTICIPANT_UNLINKED row whose user_id is NULL.
      const result = await repo.findByUserId('ghost-user-no-participant', tenantIdResult.value);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
        // Explicitly assert we didn't get back the unlinked participant.
        expect(result.value?.id).not.toBe(PARTICIPANT_UNLINKED);
      }
    });
  });
});
