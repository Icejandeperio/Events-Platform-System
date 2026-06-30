import { NextResponse } from 'next/server';
import { auth } from './auth';
import type { TenantMemberRole } from './auth';

/**
 * Authenticated request context returned when `requireRole` succeeds.
 *
 * @remarks
 * `tenantId` is the raw UUID string of the active Better Auth organization;
 * wrap it in `TenantId.create()` when a domain value object is needed.
 */
export interface AuthContext {
  /** Better Auth user ID. */
  readonly userId: string;
  /** Active tenant UUID (Better Auth organization ID). */
  readonly tenantId: string;
  /** Caller's role within the tenant organization. */
  readonly role: TenantMemberRole;
}

/** Discriminated union returned by `requireRole`. */
export type RequireRoleResult =
  | { readonly ok: true; readonly ctx: AuthContext }
  | { readonly ok: false; readonly response: NextResponse };

/**
 * Guards a route handler by verifying session, active tenant, and role membership.
 *
 * @param request - The incoming HTTP request.
 * @param allowedRoles - Roles permitted to proceed; pass all three to require only auth.
 * @returns `{ ok: true, ctx }` on success, or `{ ok: false, response }` with the rejection.
 *
 * @remarks
 * Error semantics:
 * - No session → 401
 * - Session present but no active organization → 401
 * - Active org but role absent or not in `allowedRoles` → 403
 */
export async function requireRole(
  request: Request,
  allowedRoles: TenantMemberRole[],
): Promise<RequireRoleResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
    };
  }

  const tenantId = (session.session as Record<string, unknown>)['activeOrganizationId'] as
    | string
    | null
    | undefined;
  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No active organization on session. Call setActiveOrganization first.' },
        { status: 401 },
      ),
    };
  }

  const activeMember = await auth.api.getActiveMember({ headers: request.headers });
  const role = (activeMember as Record<string, unknown> | null)?.['role'] as string | undefined;
  if (!role || !(allowedRoles as string[]).includes(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Insufficient role. Required: ${allowedRoles.join(' or ')}.` },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    ctx: { userId: session.user.id, tenantId, role: role as TenantMemberRole },
  };
}
