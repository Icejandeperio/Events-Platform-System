import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

/**
 * Better Auth browser client with the Organization plugin.
 *
 * @remarks
 * Use in Client Components for sign-in, sign-out, session hooks (`useSession`),
 * and organization management (`authClient.organization.*`).
 * On the server side, use `auth.api.*` from `@infrastructure/auth/auth` instead.
 * The base URL is the current page origin — no configuration needed for local dev.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
