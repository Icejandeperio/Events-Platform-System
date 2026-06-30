import { NextRequest, NextResponse } from 'next/server';
import { TenantId } from '@domain/value-objects/tenant-id';
import { getAppDependencies } from '../../../../../_bootstrap/bootstrap';
import { detectMimeType } from '@infrastructure/storage/magic-bytes';
import { requireRole } from '@infrastructure/auth/require-role';

/**
 * `GET /api/payments/[paymentId]/proof/serve` — serve a payment proof file.
 *
 * @remarks
 * **Authorization rule (M3c placeholder, enforced M3d-a):**
 * - `owner` (tenant_admin) and `admin` (staff): may fetch any payment proof within the tenant.
 * - `member`: blocked until M3d-b wires the user→participant ownership check.
 *
 * Security controls applied in order (SECURITY.md §4):
 * 1. Session + active org required; `owner`/`admin` only (403 for `member`).
 * 2. Payment lookup via tenant-scoped repository — RLS blocks cross-tenant access.
 * 3. `proofKey` existence check (proof must have been uploaded).
 * 4. File bytes retrieved from storage; magic bytes re-validated on serve.
 * 5. Response headers: `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`,
 *    `Content-Type` from magic bytes (never from stored metadata), `Cache-Control: private, no-store`.
 *
 * @param request - The incoming Next.js request.
 * @param context - Route context; `params.paymentId` is the target payment UUIDv4.
 * @returns 200 with file bytes on success; 401/403/404/500 on failure.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ paymentId: string }> },
): Promise<NextResponse> {
  const { paymentId } = await context.params;

  // 1. Role check — owner (tenant_admin) and admin (staff) only.
  // member is blocked until M3d-b provides the participant ownership path.
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (!authResult.ok) return authResult.response;

  const tenantIdResult = TenantId.create(authResult.ctx.tenantId);
  if (!tenantIdResult.ok) {
    return new NextResponse('Invalid tenant identifier.', { status: 400 });
  }
  const tenantId = tenantIdResult.value;

  const deps = getAppDependencies();

  // 2. Load payment — RLS ensures cross-tenant access returns NotFoundError.
  const paymentResult = await deps.paymentRepository.findById(paymentId, tenantId);
  if (!paymentResult.ok) {
    return new NextResponse('Payment not found.', { status: 404 });
  }
  const payment = paymentResult.value;

  // 3. Proof must have been uploaded.
  if (!payment.proofKey) {
    return new NextResponse('No proof has been uploaded for this payment.', { status: 404 });
  }

  // 4. Retrieve file bytes from storage.
  const fileResult = await deps.fileStorage.retrieve(payment.proofKey);
  if (!fileResult.ok) {
    return new NextResponse('Proof file not found.', { status: 404 });
  }

  // 5. Re-validate magic bytes at the HTTP boundary (SECURITY.md §4).
  // Never set Content-Type from stored metadata — always derive from file content.
  const contentType = detectMimeType(fileResult.value.buffer);
  if (contentType === null) {
    return new NextResponse('Stored file has an invalid content signature.', { status: 500 });
  }

  // 6. Stream with security headers.
  // Uint8Array is required — Buffer<ArrayBufferLike> is not assignable to BodyInit.
  return new NextResponse(new Uint8Array(fileResult.value.buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'attachment',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': String(fileResult.value.sizeBytes),
      'Cache-Control': 'private, no-store',
    },
  });
}
