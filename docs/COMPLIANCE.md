# Compliance & Data Privacy

We process the personal data of real people, so compliance is a launch
requirement, not a later cleanup. Primary law: the **Philippine Data Privacy Act
of 2012 (RA 10173)**, enforced by the **National Privacy Commission (NPC)**.
Designed to align with **GDPR** for future international clients.

> Not legal advice. Confirm current NPC rules, thresholds, and fees with the NPC
> or counsel before launch; figures below were accurate to 2026 research and the
> NPC updates circulars and fee schedules periodically.

## 1. Core obligations (RA 10173)

| Obligation | What we must do |
|---|---|
| **Data Protection Officer (DPO)** | Appoint and formally designate a DPO, independent of audited functions. |
| **Register the Data Processing System (DPS) + DPO** | Via NPC Registration System (NPCRS) online. Required when an entity employs **250+ persons**, OR processes **sensitive personal information of 1,000+ individuals**, OR processing is **likely to pose a risk to data subjects' rights**. Below thresholds: file a notarized **Sworn Declaration**. New systems register within 20 days of commencement; certificate valid 1 year. |
| **Lawful basis & consent** | Consent must be **freely given, specific, informed**, and recorded (written/electronic). No implied consent. Sensitive personal info needs a stronger basis. |
| **Privacy Notice** | Plain-language notice at every collection point (registration form, account pages) stating purpose, recipients, retention, and rights. |
| **Data subject rights** | Support: be informed, access, rectification, erasure/blocking, object, data portability, complaint, damages. |
| **Breach notification** | Notify NPC and affected subjects **within 72 hours** of knowledge when sensitive personal info is involved or real risk of serious harm exists. |
| **Privacy by design (Sec. 20)** | Organizational, physical, and technical safeguards; **Privacy Impact Assessment (PIA)** per system; Privacy Management Program + Privacy Manual. |
| **Third parties** | **Data Sharing / Processing Agreements** with every processor: hosting (Vercel/Neon), payments (PayMongo), email/SMS, storage. |

**Penalties:** criminal (imprisonment + fines up to ₱5M depending on offense)
and administrative fines (NPC Circular 2022-01: 0.25%–3% of prior-year annual
gross income, capped at ₱5M per act; registration-type failures fall in the
₱50,000–₱200,000 band). Treat as material business risk.

## 2. How the platform implements this

- **Consent capture** in the registration flow: explicit, unticked checkbox(es)
  with purpose specification and a link to the Privacy Notice; store consent
  record (who, what, when, version of notice).
- **Data minimization:** collect only what the event requires. Document each
  field's purpose. No "nice to have" PII.
- **Retention & disposal:** define a retention schedule per data category;
  implement automated purge/anonymization after the period.
- **Data-subject-rights tooling:** participant profile page supports view, edit
  (rectification), export (portability), and erasure requests; staff tooling
  routes and logs these requests with SLAs.
- **Audit log** of all PII access and changes (see `docs/SECURITY.md` §7).
- **Encryption** in transit (TLS) and at rest (DB/storage layer).
- **DPA register:** maintain `docs/compliance/processing-register.md` listing each
  processing activity, basis, recipients, retention, and safeguards.

## 3. PCI-DSS (because payments)

- We use a **hosted payment gateway redirect** so **no cardholder data (PAN)
  touches our servers** → we qualify for **SAQ-A** (~22 controls vs 300+ for
  SAQ-D). This is a deliberate architectural decision; do not break it.
- Payment pages still require **CSP + payment-script integrity monitoring**
  (PCI v4.0.1 Req 6.4.3 / 11.6.1).
- The MVP manual flow (screenshot upload) involves **no card data** and is out of
  PCI card scope, but the uploaded images are personal data under the DPA — apply
  the same protection (access control, retention, audit).

## 4. International alignment (future-proofing)

- **GDPR:** structurally similar to RA 10173 (DPO, 72-hour breach, broad rights).
  GDPR-aligned design largely satisfies both; add rigorous portability and a
  records-of-processing register. Fine ceiling is higher (4% global turnover).
- **OWASP ASVS L2:** the security verification baseline (see `docs/SECURITY.md`).
- **ISO 27001 posture (not certifying yet):** keep a data/asset inventory, access
  -control policy, risk register, and incident-response plan — these map directly
  onto DPA Sec. 20.

## 5. Pre-launch compliance checklist

- [ ] DPO appointed and designated in writing
- [ ] PIA completed and documented for the MVP
- [ ] DPS + DPO registered on NPCRS (or Sworn Declaration filed)
- [ ] Privacy Notice published at all collection points; internal Privacy Manual written
- [ ] Granular, recorded consent in the registration flow
- [ ] Data Processing/Sharing Agreements signed with all processors
- [ ] 72-hour breach-response runbook + notification templates ready
- [ ] Retention schedule defined; automated disposal implemented
- [ ] Data-subject-rights workflow (access/rectify/export/erase) live
- [ ] Encryption in transit + at rest; PII access audit-logged
- [ ] PCI scope confirmed SAQ-A; CSP + script monitoring on payment pages
- [ ] Processing register maintained (`docs/compliance/processing-register.md`)

## 6. Ongoing

Re-run the PIA when adding any module that changes what data is collected or how
it is used (e.g., GPS geofencing collects location — a new processing activity).
Review the processing register and consent text whenever the data model changes.
