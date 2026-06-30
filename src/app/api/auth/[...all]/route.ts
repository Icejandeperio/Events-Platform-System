import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@infrastructure/auth/auth';

/**
 * Better Auth catch-all route handler for Next.js App Router.
 *
 * @remarks
 * Delegates all `/api/auth/*` requests — sign-in, sign-out, session refresh,
 * organization membership, and any other Better Auth endpoints — to the
 * Better Auth server instance. The handler is the source of truth for session
 * cookies and CSRF tokens; never replicate auth logic outside this route.
 */
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(auth);
