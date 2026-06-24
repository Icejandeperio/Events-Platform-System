import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest 4.x configuration with two project environments.
 *
 * @remarks
 * - `unit`: pure domain + shared tests, no Node built-ins, no DB required.
 *   Runs in every CI job and local `npm test`.
 * - `integration`: infrastructure tests that require a live Postgres instance
 *   (`npm run db:up` first). Isolated by the `@integration` file suffix.
 *
 * Path aliases mirror tsconfig.json so `@domain/*`, `@shared/*`, etc. resolve
 * correctly inside test files without Next.js's compiler.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@application': resolve(__dirname, 'src/application'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@interfaces': resolve(__dirname, 'src/interfaces'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/**/*.integration.test.ts'],
          environment: 'node',
          coverage: {
            provider: 'v8',
            include: ['src/domain/**', 'src/application/**', 'src/shared/**'],
          },
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          environment: 'node',
          // Integration tests require `npm run db:up` before running.
          // In CI, the postgres service container provides the DB.
          setupFiles: [],
        },
      },
    ],
  },
});
