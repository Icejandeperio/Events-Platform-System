import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration.
 *
 * @remarks
 * Schema lives in src/infrastructure/db/schema/. Migrations are generated into
 * src/infrastructure/db/migrations/ and applied via `npm run db:migrate`.
 * The app connects as a non-owner, non-BYPASSRLS role (see ARCHITECTURE.md §4).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/db/schema/index.ts',
  out: './src/infrastructure/db/migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  // Verbose output so migrations are auditable in CI logs
  verbose: true,
  strict: true,
});
