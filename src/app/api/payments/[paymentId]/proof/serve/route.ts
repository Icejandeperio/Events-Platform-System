import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@infrastructure/auth/auth';
import { TenantId } from '@domain/value-objects/tenant-id';
import { getDevDependencies } from '../../../../../_bootstrap/bootstrap';
import { detectMimeType } from '@infrastructure/storage/magic-bytes';

/**
 * `GET /api/payments/[paymentId]/proof/serve` — serve a payment proof file.
 *
 * @remarks
 * **Authorization rule (M3c):**
 * - `owner` (tenant_admin) and `admin` (staff): may fetch any payment proof within the tenant.
 * - `member`: blocked — no user→participant binding exists yet (M3d will add participant
 *   self-service access once the Better Auth user ↔ participant link is wired).
 *
 * Rationale: staff reviewing proofs is the primary M3c use case. Permitting any tenant
 * member without an ownership check would let participants read each other's proofs.
 * Blocking `member` entirely is the safe default until M3d provides the ownership path.
 *
 * Security controls applied in order (SECURITY.md §4):
 * 1. Session required (401 if absent).
 * 2. Active organization required (tenant from session).
 * 3. Role check: `owner` or `admin` only (403 for `member`).
 * 4. Payment lookup via tenant-scoped repository — RLS blocks cross-tenant access.
 * 5. `proofKey` existence check (proof must have been uploaded).
 * 6. File bytes retrieved from storage; magic bytes re-validated on serve.
 * 7. Response headers: `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`,
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

  // 1. Require a valid session.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new NextResponse('Authentication required.', { status: 401 });
  }

  // 2. Resolve tenant from the session's active organization.
  const tenantIdStr = (session.session as Record<string, unknown>)['activeOrganizationId'] as
    | string
    | null
    | undefined;
  if (!tenantIdStr) {
    return new NextResponse('No active organization on session.', { status: 401 });
  }
  const tenantIdResult = TenantId.create(tenantIdStr);
  if (!tenantIdResult.ok) {
    return new NextResponse('Invalid tenant identifier.', { status: 400 });
  }
  const tenantId = tenantIdResult.value;

  // 3. Role check — owner (tenant_admin) and admin (staff) only.
  // `member` is blocked until M3d wires the user→participant link for ownership checks.
  const activeMember = await auth.api.getActiveMember({ headers: request.headers });
  const memberRole = (activeMember as Record<string, unknown> | null)?.['role'] as
    | string
    | undefined;
  if (memberRole !== 'owner' && memberRole !== 'admin') {
    return new NextResponse('Staff or admin role required.', { status: 403 });
  }

  const deps = getDevDependencies();

  // 4. Load payment — RLS ensures cross-tenant access returns NotFoundError.
  const paymentResult = await deps.paymentRepository.findById(paymentId, tenantId);
  if (!paymentResult.ok) {
    return new NextResponse('Payment not found.', { status: 404 });
  }
  const payment = paymentResult.value;

  // 5. Proof must have been uploaded.
  if (!payment.proofKey) {
    return new NextResponse('No proof has been uploaded for this payment.', { status: 404 });
  }

  // 6. Retrieve file bytes from storage.
  const fileResult = await deps.fileStorage.retrieve(payment.proofKey);
  if (!fileResult.ok) {
    return new NextResponse('Proof file not found.', { status: 404 });
  }

  // 7. Re-validate magic bytes at the HTTP boundary (SECURITY.md §4).
  // Never set Content-Type from stored metadata — always derive from file content.
  const contentType = detectMimeType(fileResult.value.buffer);
  if (contentType === null) {
    return new NextResponse('Stored file has an invalid content signature.', { status: 500 });
  }

  // 8. Stream with security headers.
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
