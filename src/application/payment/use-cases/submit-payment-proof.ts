import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { DomainError, NotFoundError, ValidationError } from '@shared/errors';
import type { PaymentStatus } from '@domain/entities/payment';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type { PaymentRepositoryPort } from '@application/payment/ports/payment-repository.port';
import type { RegistrationRepositoryPort } from '@application/registration/ports/registration-repository.port';
import type { FileStoragePort, FileUpload } from '@application/storage/ports/file-storage.port';
import type { ClockPort } from '@application/clock/ports/clock.port';
import type { IdPort } from '@application/id/ports/id.port';

/** MIME types allowed for payment proof uploads (SECURITY.md §4). */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

/** Maximum proof file size in bytes: 8 MB (SECURITY.md §4). */
const MAX_PROOF_SIZE_BYTES = 8 * 1024 * 1024;

/** Command input for the `SubmitPaymentProof` use case. */
export interface SubmitPaymentProofCommand {
  /** Tenant in whose context the payment exists. */
  readonly tenantId: TenantId;
  /** The payment record to attach proof to. */
  readonly paymentId: string;
  /**
   * The participant submitting proof — used to verify ownership of the registration.
   * In the guest flow, this is the `participantId` stored in the session cookie
   * issued at registration time.
   */
  readonly participantId: string;
  /** The uploaded file (buffer + metadata). */
  readonly file: FileUpload;
}

/** Output returned on successful proof submission. */
export interface SubmitPaymentProofResult {
  readonly paymentId: string;
  readonly status: PaymentStatus;
}

/** Port dependencies for `SubmitPaymentProof`. */
export interface SubmitPaymentProofDeps {
  readonly payments: PaymentRepositoryPort;
  readonly registrations: RegistrationRepositoryPort;
  readonly fileStorage: FileStoragePort;
  readonly clock: ClockPort;
  readonly id: IdPort;
}

/**
 * Attaches a payment proof screenshot to a payment and transitions it to `SUBMITTED`.
 *
 * @remarks
 * Responsibilities (in order):
 * 1. Validate file type and size at the use-case level (defense in depth;
 *    magic-byte validation also happens in `LocalFileStorageAdapter` — SECURITY §4).
 * 2. Load the payment and assert it is in `PENDING` or `REJECTED` state.
 * 3. Verify the caller owns the associated registration (BOLA guard).
 * 4. Store the file via `FileStoragePort` under a UUID-based key.
 * 5. Transition `Payment` to `SUBMITTED` and persist.
 *
 * Authorization: the participant who created the registration.
 * Tenant isolation: all repository calls are scoped to `cmd.tenantId`.
 */
export class SubmitPaymentProof {
  /**
   * @param deps - Port implementations injected by the composition root.
   */
  constructor(private readonly deps: SubmitPaymentProofDeps) {}

  /**
   * Executes the proof-submission flow.
   *
   * @param cmd - The command containing payment ID, caller identity, and file.
   * @returns The updated payment ID and status, or a typed domain error.
   */
  async execute(
    cmd: SubmitPaymentProofCommand,
  ): Promise<Result<SubmitPaymentProofResult, DomainError>> {
    // 1. Validate file at the use-case boundary (SECURITY.md §4 defense in depth).
    if (!ALLOWED_MIME_TYPES.has(cmd.file.mimeType)) {
      return err(
        new ValidationError(
          `File type '${cmd.file.mimeType}' is not allowed. Accepted: JPEG, PNG, PDF.`,
          'file',
        ),
      );
    }
    if (cmd.file.sizeBytes > MAX_PROOF_SIZE_BYTES) {
      return err(
        new ValidationError(
          `File exceeds the 8 MB size limit (received ${(cmd.file.sizeBytes / 1_048_576).toFixed(1)} MB).`,
          'file',
        ),
      );
    }

    const now = this.deps.clock.now();

    // 2. Load payment — RLS enforces tenant boundary in production adapter.
    const paymentResult = await this.deps.payments.findById(cmd.paymentId, cmd.tenantId);
    if (!paymentResult.ok) return err(paymentResult.error);
    const payment = paymentResult.value;

    // Validate the payment is in a state that allows proof submission.
    if (payment.status !== 'PENDING' && payment.status !== 'REJECTED') {
      return err(
        new DomainError(
          `Cannot submit proof for a payment with status '${payment.status}'. Expected 'PENDING' or 'REJECTED'.`,
        ),
      );
    }

    // 3. BOLA guard — verify the caller owns this registration.
    const regResult = await this.deps.registrations.findById(payment.registrationId, cmd.tenantId);
    if (!regResult.ok) return err(regResult.error);
    if (regResult.value.participantId !== cmd.participantId) {
      // Return NotFoundError (not UnauthorizedError) to avoid leaking existence (SECURITY §1).
      return err(new NotFoundError('Payment', cmd.paymentId));
    }

    // 4. Store the file with a UUID-based key outside the web root (SECURITY.md §4).
    const storageKey = `tenants/${cmd.tenantId.value}/payments/${this.deps.id.generate()}`;
    const storeResult = await this.deps.fileStorage.store(storageKey, cmd.file);
    if (!storeResult.ok) return err(storeResult.error);

    // 5. Transition the payment entity (state machine guard is inside `submit()`).
    const submittedResult = payment.submit(storageKey, now);
    if (!submittedResult.ok) return err(submittedResult.error);

    const saveResult = await this.deps.payments.save(submittedResult.value);
    if (!saveResult.ok) return err(saveResult.error);

    return ok({ paymentId: cmd.paymentId, status: submittedResult.value.status });
  }
}
