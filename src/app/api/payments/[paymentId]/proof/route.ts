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
 * Security controls applied in order (SECURITY.md §4):
 * 1. Session + active org required; any authenticated member may upload (role: owner/admin/member).
 * 2. Size capped at 8 MB before reading all bytes.
 * 3. Magic-byte validation — JPEG/PNG/PDF only; Content-Type header is ignored.
 * 4. BOLA ownership guard delegated to `SubmitPaymentProof` use case.
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

  // 1. Require session + active org (any role may upload; BOLA is use-case-level).
  const authResult = await requireRole(request, ['owner', 'admin', 'member']);
  if (!authResult.ok) return authResult.response;

  const tenantIdResult = TenantId.create(authResult.ctx.tenantId);
  if (!tenantIdResult.ok) {
    return NextResponse.json({ error: 'Invalid tenant identifier.' }, { status: 400 });
  }
  const tenantId = tenantIdResult.value;

  // 2. Parse multipart form data.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Request must be multipart/form-data.' }, { status: 400 });
  }

  const rawFile = formData.get('file');
  const participantId = formData.get('participantId');

  if (!(rawFile instanceof File)) {
    return NextResponse.json({ error: 'A "file" field is required.' }, { status: 400 });
  }
  if (typeof participantId !== 'string' || participantId.trim() === '') {
    return NextResponse.json({ error: 'A "participantId" field is required.' }, { status: 400 });
  }

  // 3. Enforce size limit before reading all bytes (SECURITY.md §4).
  if (rawFile.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds the 8 MB limit (received ${(rawFile.size / 1_048_576).toFixed(1)} MB).`,
      },
      { status: 413 },
    );
  }

  // 4. Validate magic bytes — ignore the client-supplied Content-Type (SECURITY.md §4).
  const buffer = Buffer.from(await rawFile.arrayBuffer());
  const detectedMime = detectMimeType(buffer);
  if (detectedMime === null) {
    return NextResponse.json(
      { error: 'File type not allowed. Accepted: JPEG, PNG, PDF.' },
      { status: 415 },
    );
  }

  // 5. Execute use case — BOLA ownership guard is inside the use case.
  const deps = getAppDependencies();
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
    participantId: participantId.trim(),
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
