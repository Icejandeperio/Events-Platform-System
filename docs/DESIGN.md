# Design System & Page Inventory

The visual and structural spec. Pair with `docs/UIUX.md` (behavior rules).

## 1. Design system

- **Components:** **shadcn/ui** (Radix primitives + Tailwind CSS). We own the
  component source (copy-in, not a black-box dependency); Radix gives keyboard/ARIA
  accessibility by default.
- **Charts/KPIs:** shadcn/ui charts (Recharts). Tremor is not used.
- **Icons:** Lucide.
- **Theming:** Tailwind v4 CSS variables via `@theme` in `globals.css` (no
  `tailwind.config.js` — v4 is CSS-first). Each tenant gets white-label branding
  (one accent color + logo) without code forks.

## 2. Visual direction

"Fintech-lite": clean, trustworthy, calm. Generous whitespace, strong type
hierarchy, one tenant accent color, high contrast, large tap targets. Trust cues
on payment screens (amounts, provider logos, security badges). Avoid decorative
clutter — the product's job is to get people registered and paid.

**Tokens (starting point — tune per brand, defined under `@theme` in `globals.css`):**
- Radius: `0.625rem`. Spacing scale: Tailwind default.
- Typography: system UI / Inter; clear scale (e.g., 32/24/20/16/14).
- Color: neutral slate base + a single configurable accent; semantic
  success/warning/destructive. All pairings must pass 4.5:1.

## 3. Page inventory (MVP sitemap)

Grouped by audience. Each page lists **purpose**, **key components**, and
**design notes**. Pages behind a module are marked `[module]` and only render if
the tenant's entitlement is on (see `docs/FEATURES.md`).

### A. Public / marketing (per-tenant white-label)
1. **Tenant Landing / Event Listing** — *Discovery + conversion entry.*
   Hero (tenant branding), grid of open events (date, price, slots left),
   prominent Register CTA. Mobile single-column, sticky CTA.
2. **Event Detail** — *Inform + drive registration.*
   Description, schedule, location/map, pricing tiers, FAQ, Register CTA above the
   fold. Hierarchy: title → key facts → CTA → details.

### B. Registration & payment (conversion-critical core)
3. **Registration Form** — *Capture details, minimum friction.*
   Multi-step (Personal → Event/tier → Review), progress bar, inline validation,
   correct input types/autocomplete, **explicit recorded consent checkbox + Privacy
   Notice link**.
4. **Payment Instructions / Checkout** — *Make paying easy.*
   MVP manual: amount + reference code, tenant GCash/Maya/bank details with copy
   buttons, Android "how to pay" steps. Future: hosted-gateway redirect, same slot.
5. **Proof-of-Payment Upload** — *Submit screenshot.*
   Tap/drag picker (single-pointer alternative), instant preview, type/size guide,
   submit → pending confirmation.
6. **Registration Confirmation / Status** — *Reassure + set expectations.*
   Status badge (Pending / Submitted / Confirmed / Rejected), reference number,
   what-happens-next, help link.

### C. Participant-facing (authenticated)
7. **Participant Login / Magic-Link** — passwordless option (accessible auth).
8. **Participant Dashboard / My Registrations** — list with payment status,
   re-upload proof if rejected, download receipt, event details.
9. **Participant Profile** — view/edit personal data (rectification), request
   export/erasure (DPA rights), manage consent.

### D. Staff / tenant-admin dashboard (the core MVP deliverable)
10. **Dashboard Home / Metrics** — KPI cards (registrations today/total, payments
    pending/verified, revenue, slots left), recent activity, simple charts.
11. **Participants Table** — sortable/filterable table (name, event, reg
    date/time, payment status, method, amount), search, row → detail drawer, CSV export.
12. **Payment Verification Queue** — pending payments with proof thumbnail,
    side-by-side viewer, Approve/Reject + reason, audit trail. Tenant-scoped + role-gated.
13. **Participant Detail** — full profile, payment history, screenshots, status
    timeline, audit-logged manual status override.
14. **Events Management** — create/edit events, pricing tiers, capacity, open/close
    registration.
15. **Tenant Settings** — branding/theme, payment-receiving details, staff
    management, **read-only view of active modules** (entitlements set by super-admin).
16. **Staff / Marshal Management** — invite staff, assign RBAC roles, deactivate.

### E. Super-admin / platform (platform owner only)
17. **Platform Dashboard** — cross-tenant metrics (tenant count, MRR, usage), system health.
18. **Tenant Management** — create/suspend tenants, per-tenant usage, audited
    impersonation for support.
19. **Entitlements / Module Management** — per-tenant feature matrix (toggle
    modules), plan/tier assignment. *This is how features are sold per business.*
20. **Platform Audit Log** — cross-tenant security/compliance event stream.
21. **Billing / Plans** *(future)* — tenant subscriptions and invoicing.

### F. Auth & system (shared)
22. **Login / Sign-up** (role-aware), **Forgot/Reset Password**, **MFA setup** (admins).
23. **403 / 404 / Error / Maintenance** pages.
24. **Privacy Notice / Terms / Cookie & Consent** pages (DPA compliance).

### Module pages (render only when entitlement is on)
- **QR Participant Pass** `[checkin]`, **Marshal Scan** `[checkin]`,
  **Check-ins History** `[checkin]`, **Offline Sync Status** `[pwa]`. See `docs/FEATURES.md`.

## 4. Component conventions

- Build pages from shadcn/ui primitives; do not hand-roll inputs/dialogs.
- Every interactive component is keyboard-operable and labeled.
- Loading: skeletons for content, optimistic UI for actions, explicit error states.
- One source of truth for status badges, money formatting, and date/time
  (Asia/Manila) — shared components in `interfaces/web/components/`.
