import { NextRequest, NextResponse } from 'next/server';
import { TenantId } from '@domain/value-objects/tenant-id';
import { getAppDependencies } from '../../../../../_bootstrap/bootstrap';
import { detectMimeType } from '@infrastructure/storage/magic-bytes';
import { requireRole } from '@infrastructure/auth/require-role';

/**
 * `GET /api/payments/[paymentId]/proof/serve` — serve a payment proof file.
 *
 * @remarks
 * **Authorization rules (M3d-b):**
 * - `owner` (tenant_admin) and `admin` (staff): may fetch any proof within the tenant.
 * - `member`: must be the participant whose registration owns this payment.
 *   A `member` with no linked participant record is denied (403).
 *   A `member` linked to a different participant than the payment owner is denied (403).
 *
 * Security controls applied in order (SECURITY.md §4, SECURITY.md §1 BOLA):
 * 1. Session + active org required (401 if absent).
 * 2. Role check: all three roles pass `requireRole`; ownership check below filters `member`.
 * 3. Payment lookup — RLS blocks cross-tenant access.
 * 4. `proofKey` existence check.
 * 5. `member`-specific: participant derived from `session.user.id`; registration checked for ownership.
 * 6. File bytes retrieved; magic bytes re-validated on serve.
 * 7. Security headers applied.
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

  // 1. Require session + active org. All roles pass this check; member ownership is below.
  const authResult = await requireRole(request, ['owner', 'admin', 'member']);
  if (!authResult.ok) return authResult.response;

  const tenantIdResult = TenantId.create(authResult.ctx.tenantId);
  if (!tenantIdResult.ok) {
    return new NextResponse('Invalid tenant identifier.', { status: 400 });
  }
  const tenantId = tenantIdResult.value;

  const deps = getAppDependencies();

  // 2. Load payment — RLS blocks cross-tenant rows.
  const paymentResult = await deps.paymentRepository.findById(paymentId, tenantId);
  if (!paymentResult.ok) {
    return new NextResponse('Payment not found.', { status: 404 });
  }
  const payment = paymentResult.value;

  // 3. Proof must have been uploaded.
  if (!payment.proofKey) {
    return new NextResponse('No proof has been uploaded for this payment.', { status: 404 });
  }

  // 4. For members: verify this payment belongs to the session participant.
  //    owner/admin can access any proof within the tenant; no ownership check needed.
  if (authResult.ctx.role === 'member') {
    // Derive participant from session — never from client input (SECURITY §1, BOLA).
    const participantResult = await deps.participantRepository.findByUserId(
      authResult.ctx.userId,
      tenantId,
    );
    if (!participantResult.ok || participantResult.value === null) {
      return new NextResponse('No participant record is linked to this account.', { status: 403 });
    }

    // Traverse payment → registration → participant to check ownership.
    const regResult = await deps.registrationRepository.findById(payment.registrationId, tenantId);
    if (!regResult.ok) {
      return new NextResponse('Payment not found.', { status: 404 });
    }

    if (regResult.value.participantId !== participantResult.value.id) {
      return new NextResponse('Not authorized to access this payment proof.', { status: 403 });
    }
  }

  // 5. Retrieve file bytes from storage.
  const fileResult = await deps.fileStorage.retrieve(payment.proofKey);
  if (!fileResult.ok) {
    return new NextResponse('Proof file not found.', { status: 404 });
  }

  // 6. Re-validate magic bytes at the HTTP boundary (SECURITY.md §4).
  // Never set Content-Type from stored metadata — always derive from file content.
  const contentType = detectMimeType(fileResult.value.buffer);
  if (contentType === null) {
    return new NextResponse('Stored file has an invalid content signature.', { status: 500 });
  }

  // 7. Stream with security headers.
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
