import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Creates a Drizzle client connected as the `tenantkit_app` role.
 *
 * @remarks
 * The app role has `SELECT / INSERT / UPDATE / DELETE` on all tables but is
 * NOT the table owner and does NOT have `BYPASSRLS`. Every query is therefore
 * subject to the RLS policies enforced by `withTenant()` (ARCHITECTURE.md §4).
 * `APP_DATABASE_URL` must be set before this module is first imported.
 * @returns A Drizzle postgres client with the full schema bound.
 */
function createAppDb() {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'APP_DATABASE_URL is not set. Copy .env.example to .env and run `npm run db:up` first.',
    );
  }
  return drizzle(postgres(url), { schema });
}

/** Application database client — RLS-enforced, non-owner role. */
export const db = createAppDb();

/** Drizzle db type for dependency injection. */
export type AppDb = typeof db;

/** Drizzle transaction type for `withTenant()` callbacks. */
export type AppDbTx = Parameters<Parameters<AppDb['transaction']>[0]>[0];
