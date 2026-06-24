/**
 * Drizzle schema barrel — re-exports all table definitions.
 *
 * @remarks
 * Table definitions are added here in Stage 1. Every tenant-owned table must
 * have a `tenant_id uuid not null` column and a matching RLS policy
 * (see docs/ARCHITECTURE.md §4 and ADR 0001).
 */

// Stage 1 will add: tenants, users, events, registrations, payments, ...
export {};
