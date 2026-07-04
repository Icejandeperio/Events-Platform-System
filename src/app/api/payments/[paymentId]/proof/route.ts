import { NextRequest, NextResponse } from 'next/server';
import { TenantId } from '@domain/value-objects/tenant-id';
import { NotFoundError, ValidationError } from '@shared/errors';
import { SubmitPaymentProof } from '@application/payment/use-cases/submit-payment-proof';
import { getAppDependencies } from '../../../../_bootstrap/bootstrap';
import { detectMimeType } from '@infrastructure/storage/magic-bytes';
import { requireRole } from '@infrastructure/auth/require-role';

/** Maximum accepted upload size: 8 MB (SECURITY.md §4). */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * `POST /api/payments/[paymentId]/proof` — upload a payment proof screenshot.
 *
 * @remarks
 * Security controls applied in order (SECURITY.md §4, SECURITY.md §1 BOLA):
 * 1. Session + active org required (any role may upload).
 * 2. Participant derived from `session.user.id → participants.user_id` — never from client input.
 *    A session user with no linked participant record is denied (403).
 * 3. Size capped at 8 MB before reading all bytes.
 * 4. Magic-byte validation — JPEG/PNG/PDF only; Content-Type header is ignored.
 * 5. BOLA ownership guard in `SubmitPaymentProof`: the payment's registration must
 *    belong to the session-derived participant.
 *
 * @param request - The incoming Next.js request.
 * @param context - Route context; `params.paymentId` is the target payment UUIDv4.
 * @returns 201 on success; 401/403/413/415/422/404/400 on failure.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ paymentId: string }> },
): Promise<NextResponse> {
  const { paymentId } = await context.params;

  // 1. Require session + active org (any role may upload).
  const authResult = await requireRole(request, ['owner', 'admin', 'member']);
  if (!authResult.ok) return authResult.response;

  const tenantIdResult = TenantId.create(authResult.ctx.tenantId);
  if (!tenantIdResult.ok) {
    return NextResponse.json({ error: 'Invalid tenant identifier.' }, { status: 400 });
  }
  const tenantId = tenantIdResult.value;

  // 2. Derive participant from session — never from the request body (SECURITY §1, BOLA).
  const deps = getAppDependencies();
  const participantResult = await deps.participantRepository.findByUserId(
    authResult.ctx.userId,
    tenantId,
  );
  if (!participantResult.ok) {
    return NextResponse.json({ error: 'Internal error resolving participant.' }, { status: 500 });
  }
  if (participantResult.value === null) {
    return NextResponse.json(
      { error: 'No participant record is linked to this account.' },
      { status: 403 },
    );
  }
  const participantId = participantResult.value.id;

  // 3. Parse multipart form data.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Request must be multipart/form-data.' }, { status: 400 });
  }

  const rawFile = formData.get('file');
  if (!(rawFile instanceof File)) {
    return NextResponse.json({ error: 'A "file" field is required.' }, { status: 400 });
  }

  // 4. Enforce size limit before reading all bytes (SECURITY.md §4).
  if (rawFile.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds the 8 MB limit (received ${(rawFile.size / 1_048_576).toFixed(1)} MB).`,
      },
      { status: 413 },
    );
  }

  // 5. Validate magic bytes — ignore the client-supplied Content-Type (SECURITY.md §4).
  const buffer = Buffer.from(await rawFile.arrayBuffer());
  const detectedMime = detectMimeType(buffer);
  if (detectedMime === null) {
    return NextResponse.json(
      { error: 'File type not allowed. Accepted: JPEG, PNG, PDF.' },
      { status: 415 },
    );
  }

  // 6. Execute use case — BOLA ownership guard: payment's registration must belong to this participant.
  const useCase = new SubmitPaymentProof({
    payments: deps.paymentRepository,
    registrations: deps.registrationRepository,
    fileStorage: deps.fileStorage,
    clock: deps.clock,
    id: deps.idProvider,
  });

  const result = await useCase.execute({
    tenantId,
    paymentId,
    participantId,
    file: {
      buffer,
      mimeType: detectedMime,
      originalName: rawFile.name,
      sizeBytes: rawFile.size,
    },
  });

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    if (result.error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: result.error.message,
          ...(result.error.field ? { field: result.error.field } : {}),
        },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(
    { paymentId: result.value.paymentId, status: result.value.status },
    { status: 201 },
  );
}
