import { InMemoryParticipantRepository } from '@infrastructure/participants/fakes/in-memory-participant-repository';
import { FakePaymentProvider } from '@infrastructure/payment-provider/fakes/fake-payment-provider';
import { InMemoryFileStorage } from '@infrastructure/storage/fakes/in-memory-file-storage';
import { FakeNotifier } from '@infrastructure/notifications/fakes/fake-notifier';
import { StubClock } from '@infrastructure/clock/fakes/stub-clock';
import { SequentialIdFake } from '@infrastructure/id/fakes/sequential-id';
import type { ParticipantRepositoryPort } from '@application/participants/ports/participant-repository.port';
import type { PaymentProviderPort } from '@application/payment-provider/ports/payment-provider.port';
import type { FileStoragePort } from '@application/storage/ports/file-storage.port';
import type { NotifierPort } from '@application/notifications/ports/notifier.port';
import type { ClockPort } from '@application/clock/ports/clock.port';
import type { IdPort } from '@application/id/ports/id.port';

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
    paymentProvider: new FakePaymentProvider(),
    fileStorage: new InMemoryFileStorage(),
    notifier: new FakeNotifier(),
    clock: new StubClock(),
    idProvider: new SequentialIdFake(),
  };
}
