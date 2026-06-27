-- Migration: app role creation, permissions, and FORCE ROW LEVEL SECURITY
--
-- Runs as the DB owner (tenantkit / superuser).
-- Creates the non-owner, non-BYPASSRLS application role used by the app at
-- runtime. All app queries run as this role so RLS is enforced on every query
-- (ARCHITECTURE.md §4, SECURITY.md §9, ADR 0001).
--
-- FORCE ROW LEVEL SECURITY ensures policies fire even if the app ever
-- accidentally connects as the table owner (defense in depth).

-- ── App role ──────────────────────────────────────────────────────────────────
-- Password is intentionally hardcoded here for local dev / CI.
-- Production credentials are injected via the platform secret store (not repo).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenantkit_app') THEN
    CREATE ROLE tenantkit_app WITH LOGIN PASSWORD 'tenantkit_pass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT CONNECT ON DATABASE tenantkit_dev TO tenantkit_app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO tenantkit_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tenantkit_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tenantkit_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tenantkit_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tenantkit_app;
--> statement-breakpoint
-- ── FORCE ROW LEVEL SECURITY (all tenant-scoped tables) ──────────────────────
-- ENABLE was set by drizzle-kit in migration 0000. FORCE additionally applies
-- policies to the table OWNER role (defense in depth per ARCHITECTURE.md §4).
ALTER TABLE "member"              FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invitation"          FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"              FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pricing_tiers"       FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "participants"        FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "registrations"       FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payments"            FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_entitlements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "consent_records"     FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log"           FORCE ROW LEVEL SECURITY;