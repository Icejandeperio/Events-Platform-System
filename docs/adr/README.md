# Architecture Decision Records (ADRs)

An ADR captures one significant, hard-to-reverse decision: the context, the
decision, the alternatives, and the consequences. We use the Michael Nygard
format. ADRs are immutable once Accepted — to change a decision, write a new ADR
that **supersedes** the old one (don't edit history).

## When to write one
Write an ADR for decisions that are expensive to reverse or cross module
boundaries: stack, tenancy model, auth strategy, payment abstraction, data model
seams, introducing a new external dependency. **Do not** write ADRs for trivial
or cosmetic choices. Adding an ADR is part of the Definition of Done for
architectural work.

## Conventions
- Filename: `NNNN-short-kebab-title.md`, sequential, never reused.
- Status: `Proposed` → `Accepted` → (`Deprecated` | `Superseded by NNNN`).
- Keep it short: a screen or two. Link to code/docs rather than duplicating.

## Index
| # | Title | Status |
|---|---|---|
| 0001 | Multi-tenancy via Postgres Row-Level Security | Accepted |
| 0002 | Stack: Next.js 16 + Drizzle ORM + PostgreSQL | Accepted (amended) |
| 0003 | Payments behind a PaymentProvider port | Accepted |
| 0004 | Authentication via Better Auth | Accepted |

---

## Template

```markdown
# NNNN. <Title>

- Status: Proposed | Accepted | Deprecated | Superseded by NNNN
- Date: YYYY-MM-DD
- Deciders: <names/roles>

## Context
What forces are at play? What problem/constraint requires a decision?

## Decision
The choice we are making, stated plainly.

## Alternatives considered
- Option A — why not.
- Option B — why not.

## Consequences
Positive, negative, and follow-ups this creates. What becomes easier/harder.
```
