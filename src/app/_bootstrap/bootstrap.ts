import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { InMemoryParticipantRepository } from '@infrastructure/participants/fakes/in-memory-participant-repository';
import { FakePaymentProvider } from '@infrastructure/payment-provider/fakes/fake-payment-provider';
import { InMemoryFileStorage } from '@infrastructure/storage/fakes/in-memory-file-storage';
import { LocalDiskStorageAdapter } from '@infrastructure/storage/local-disk-storage';
import { FakeNotifier } from '@infrastructure/notifications/fakes/fake-notifier';
import { StubClock } from '@infrastructure/clock/fakes/stub-clock';
import { SequentialIdFake } from '@infrastructure/id/fakes/sequential-id';
import { InMemoryEventRepository } from '@infrastructure/events/fakes/in-memory-event-repository';
import { InMemoryRegistrationRepository } from '@infrastructure/registration/fakes/in-memory-registration-repository';
import { InMemoryPaymentRepository } from '@infrastructure/payment/fakes/in-memory-payment-repository';
import { InMemoryConsentRepository } from '@infrastructure/consent/fakes/in-memory-consent-repository';
import { InMemoryAuditLog } from '@infrastructure/audit/fakes/in-memory-audit-log';
import { DrizzleEventRepository } from '@infrastructure/events/drizzle-event-repository';
import { DrizzleRegistrationRepository } from '@infrastructure/registration/drizzle-registration-repository';
import { DrizzlePaymentRepository } from '@infrastructure/payment/drizzle-payment-repository';
import { DrizzleConsentRepository } from '@infrastructure/consent/drizzle-consent-repository';
import { DrizzleAuditLog } from '@infrastructure/audit/drizzle-audit-log';
import { SystemClock } from '@infrastructure/clock/system-clock';
import { CryptoIdAdapter } from '@infrastructure/id/crypto-id';
import * as schema from '@infrastructure/db/schema';
import type { ParticipantRepositoryPort } from '@application/participants/ports/participant-repository.port';
import type { PaymentProviderPort } from '@application/payment-provider/ports/payment-provider.port';
import type { FileStoragePort } from '@application/storage/ports/file-storage.port';
import type { NotifierPort } from '@application/notifications/ports/notifier.port';
import type { ClockPort } from '@application/clock/ports/clock.port';
import type { IdPort } from '@application/id/ports/id.port';
import type { EventRepositoryPort } from '@application/events/ports/event-repository.port';
import type { RegistrationRepositoryPort } from '@application/registration/ports/registration-repository.port';
import type { PaymentRepositoryPort } from '@application/payment/ports/payment-repository.port';
import type { ConsentRepositoryPort } from '@application/consent/ports/consent-repository.port';
import type { AuditLogPort } from '@application/audit/ports/audit-log.port';

/**
 * All application-level dependencies, expressed as port interfaces.
 *
 * @remarks
 * Use-cases receive this object via dependency injection rather than importing
 * concrete adapters directly. In production, swap fake implementations for real
 * adapters (Drizzle repo, Paymongo adapter, Vercel Blob, Resend/Twilio, etc.)
 * without touching any domain or application code.
 */
export interface AppDependencies {
  /** Repository for participant aggregate persistence. */
  readonly participantRepository: ParticipantRepositoryPort;
  /** Read-only port for event data (status, pricing tiers, capacity). */
  readonly eventRepository: EventRepositoryPort;
  /** Repository for registration entity persistence. */
  readonly registrationRepository: RegistrationRepositoryPort;
  /** Repository for payment entity persistence. */
  readonly paymentRepository: PaymentRepositoryPort;
  /** Append-only port for participant consent records (RA 10173). */
  readonly consentRepository: ConsentRepositoryPort;
  /** Append-only port for the security audit log (SECURITY.md §7). */
  readonly auditLog: AuditLogPort;
  /** Payment gateway adapter for checkout URLs and webhook verification. */
  readonly paymentProvider: PaymentProviderPort;
  /** Object storage adapter for file uploads and signed URLs. */
  readonly fileStorage: FileStoragePort;
  /** Notification adapter for email and SMS delivery. */
  readonly notifier: NotifierPort;
  /** Wall-clock abstraction for deterministic time in tests. */
  readonly clock: ClockPort;
  /** Unique-ID generator abstraction (UUIDv4 in production). */
  readonly idProvider: IdPort;
}

/**
 * Constructs an `AppDependencies` object wired with all in-memory fakes.
 *
 * @remarks
 * Use this in unit tests instead of real adapters. For integration tests that
 * need a real DB, override individual fields on the returned object.
 *
 * @returns A fully-wired `AppDependencies` using fake/stub implementations.
 */
export function bootstrapFakes(): AppDependencies {
  return {
    participantRepository: new InMemoryParticipantRepository(),
    eventRepository: new InMemoryEventRepository(),
    registrationRepository: new InMemoryRegistrationRepository(),
    paymentRepository: new InMemoryPaymentRepository(),
    consentRepository: new InMemoryConsentRepository(),
    auditLog: new InMemoryAuditLog(),
    paymentProvider: new FakePaymentProvider(),
    fileStorage: new InMemoryFileStorage(),
    notifier: new FakeNotifier(),
    clock: new StubClock(),
    idProvider: new SequentialIdFake(),
  };
}

/**
 * Constructs an `AppDependencies` object wired with real infrastructure adapters.
 *
 * @remarks
 * Reads `APP_DATABASE_URL` from the environment at call time (not at import time —
 * unit tests that import this module but only call `bootstrapFakes()` are safe).
 * The postgres connection is kept alive for the lifetime of the returned object;
 * call `.destroy()` on the underlying `postgres` client when shutting down.
 *
 * The `participantRepository` remains in-memory for M3b; it will be replaced
 * with `DrizzleParticipantRepository` in M3d when the full registration UI and
 * Better Auth session wiring are in place.
 *
 * @returns A fully-wired `AppDependencies` using real Drizzle adapters and infrastructure.
 */
export function bootstrapDev(): AppDependencies {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'APP_DATABASE_URL is not set. Copy .env.example to .env and run `npm run db:up` first.',
    );
  }
  const db = drizzle(postgres(url), { schema });

  return {
    // TODO(M3d): replace with DrizzleParticipantRepository once the auth/UI layer is in place.
    participantRepository: new InMemoryParticipantRepository(),
    eventRepository: new DrizzleEventRepository(db),
    registrationRepository: new DrizzleRegistrationRepository(db),
    paymentRepository: new DrizzlePaymentRepository(db),
    consentRepository: new DrizzleConsentRepository(db),
    auditLog: new DrizzleAuditLog(db),
    paymentProvider: new FakePaymentProvider(),
    fileStorage: new LocalDiskStorageAdapter(join(process.cwd(), 'storage')),
    notifier: new FakeNotifier(),
    clock: new SystemClock(),
    idProvider: new CryptoIdAdapter(),
  };
}

/** Module-level singleton — created once per process, safe for Next.js route handlers. */
let _devDeps: AppDependencies | undefined;

/**
 * Returns the singleton `AppDependencies` for development route handlers.
 *
 * @remarks
 * Lazily initializes `bootstrapDev()` on the first call. Module-level
 * singletons are safe in Next.js App Router (one instance per cold start).
 * Never call in unit tests — use `bootstrapFakes()` instead.
 *
 * @returns The shared `AppDependencies` instance for the current process.
 */
export function getDevDependencies(): AppDependencies {
  if (_devDeps === undefined) {
    _devDeps = bootstrapDev();
  }
  return _devDeps;
}
