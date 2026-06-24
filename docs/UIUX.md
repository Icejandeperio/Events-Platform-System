# UI/UX Standards

The conversion-critical path is **registration → payment**. Most PAT users are on
**Android phones with variable connectivity**. Every UX decision optimizes for
finishing a registration and paying with minimum friction, while meeting
**WCAG 2.2 AA**.

## 1. Principles

1. **Mobile-first, thumb-first.** Design for a one-handed Android user on a slow
   connection. Desktop is the enhancement, not the baseline.
2. **Fewer fields, fewer steps.** Every field must justify itself (and satisfy
   data minimization — see `docs/COMPLIANCE.md`). Multi-step with a progress
   indicator beats one long form.
3. **Never make the user think about payment mechanics.** Show the exact amount,
   a copyable reference, and clear next steps.
4. **Always show state.** Pending / verified / rejected must be unambiguous.
5. **Trust on money screens.** Clear amounts, provider logos, security cues.

## 2. Mobile-first form rules

- Single column; large tap targets; primary action reachable by thumb; sticky CTA.
- **Correct input types & autocomplete:** `type="tel"` for PH mobile numbers,
  `type="email"`, numeric keyboards for numeric fields, and proper `autocomplete`
  tokens (autofill dramatically increases completion).
- Inline, real-time validation with specific messages; never clear the form on error.
- **No CAPTCHA** where avoidable (high failure/abandonment). Use invisible/honeypot
  bot protection — which also satisfies WCAG 2.2 SC 3.3.7 Accessible Authentication.
- **Don't re-ask** for data already given (WCAG 2.2 SC 3.3.9 Redundant Entry):
  offer "same as contact" toggles.
- Resilient to poor networks: optimistic UI, explicit pending/retry states, small
  payloads, client-side image compression before upload.

## 3. Payment UX (MVP manual flow)

1. Show amount + unique reference code (copy buttons).
2. Show the tenant's receiving details (GCash/Maya/bank) with copy buttons and a
   short, Android-specific "how to pay" guide.
3. Upload proof: tap/drag picker (with a single-pointer alternative — WCAG 2.5.7),
   instant thumbnail preview, file-type/size guidance.
4. Confirm with a clear "we'll verify within X hours" expectation and a status link.

(When the real gateway lands, this screen becomes a redirect to hosted checkout —
same position in the flow, swapped behind the `PaymentProvider` port.)

## 4. Dashboard UX (staff)

- The **payment verification queue** is the staff core task — make it fast:
  thumbnail list → side-by-side viewer (amount, reference, proof) → Approve/Reject
  with reason, fully keyboard-operable.
- Data tables: sortable, filterable, paginated, with search and CSV export. Row →
  detail drawer rather than full navigation where possible.
- KPI cards above the fold; charts secondary. Don't overload the first screen.

## 5. WCAG 2.2 AA conformance (required)

- Text contrast ≥ **4.5:1** (3:1 for large text); never encode meaning by color alone.
- **Visible, unobscured focus indicator** (SC 2.4.11/2.4.13).
- **Target size ≥ 24×24 px** (SC 2.5.8); we use ~44 px for primary mobile actions.
- **Dragging has a single-pointer alternative** (SC 2.5.7).
- **Consistent help** placement (SC 3.2.6); **Accessible Authentication** (3.3.7);
  **Redundant Entry** avoided (3.3.9).
- Semantic HTML + landmarks; labels tied to inputs; full keyboard operability;
  alt text; respects reduced-motion and 200% zoom.
- **Testing:** axe DevTools in CI + manual screen-reader pass (VoiceOver/TalkBack)
  on the registration and payment flows before release.

## 6. Content & tone

- Plain, concrete language. PH English. Short labels. No jargon on participant-
  facing screens. Error messages tell the user how to fix the problem.

## 7. Performance budget (UX is speed)

- Registration route interactive in < 2.5 s on a mid-range Android over 4G.
- Lazy-load dashboard charts and heavy modules; ship the registration path lean.
- Compress and resize images client-side before upload.

See `docs/DESIGN.md` for the design system, visual direction, and full page
inventory.
