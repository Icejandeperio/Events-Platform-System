# Documentation Discipline

The requirement: the codebase must be readable by any human engineer, every
function carries a note on what it is for, and every change produces a
documentation update. This file defines how — using the professional standard,
not noise.

## 1. The standard (what "comment everything" actually means here)

Comment **intent (why)**, not mechanics (what). Clear names and small functions
carry the "what"; comments that restate code rot into lies. So:

- **TSDoc is MANDATORY on every exported symbol** — function, class, type,
  interface, and module. This is what satisfies "every function has a note,"
  and it is **lint-enforced** (merges blocked without it).
- **Intent comments** on non-obvious blocks (a tricky invariant, a regulatory
  reason, a workaround) — explain *why*.
- **Do not** add a comment to every line. Per-line narration reduces readability
  and the agent will generate filler. Readable names + TSDoc + intent notes is the
  bar.

### TSDoc shape (required)
```ts
/**
 * Registers a participant for an event and creates a PENDING payment.
 *
 * @remarks Tenant-scoped: relies on the active RLS context. Idempotent on email
 * within an event (see CheckEmailUniqueness).
 * @param input - Validated registration DTO (see dto/RegisterForEvent).
 * @returns The created participant id and a PENDING payment reference.
 * @throws DuplicateRegistrationError when the email already registered for the event.
 */
export async function registerForEvent(input: RegisterForEventInput): Promise<RegisterForEventResult> { ... }
```

Every **file** starts with a one-line header comment stating its purpose. Every
**module folder** has a short `README.md` explaining what it owns.

## 2. Enforcement (tooling, not willpower)

- `eslint-plugin-tsdoc` / `eslint-plugin-jsdoc`: require TSDoc on exports; validate syntax.
- Husky + lint-staged: run the doc lint on staged files at commit.
- CI fails if any exported symbol lacks TSDoc.
- TypeDoc generates browsable API docs from TSDoc (optional but recommended).

## 3. The "documentation update report" for every move

This is **Conventional Commits + automated changelog + ADRs + docs updates**,
run as a loop on every change (also in `CLAUDE.md`):

1. **TSDoc** updated on every touched export.
2. **Conventional Commit** written (`feat`, `fix`, `docs`, `refactor`, `perf`,
   `test`, `build`, `ci`, `chore`, `revert`; scoped). This is the per-change record.
3. **`CHANGELOG.md`** is generated from commits by `release-please` — never
   hand-edited. The changelog *is* the running documentation report.
4. **ADR** appended (`docs/adr/`) when an architectural decision was made.
5. **`docs/` page** updated when a contract/behavior/data model changed.
6. The **PR description** summarizes what changed, why, and which docs/ADRs moved.

So "a documentation update report for every single move" = a valid Conventional
Commit (every move) + an auto-generated changelog entry (every move) + an ADR
(every structural move) + a docs edit (every behavior change). It is automatic
and auditable rather than a separate manual document.

## 4. What lives where

| Kind of knowledge | Home |
|---|---|
| Why a function exists / how to call it | TSDoc on the symbol |
| What a module owns | module `README.md` |
| Why we chose an approach | `docs/adr/NNNN-*.md` |
| Standards & rules | `docs/*.md` |
| What changed over time | `CHANGELOG.md` (generated) |
| How to contribute | `CONTRIBUTING.md` |
| Operating rules for agents | `CLAUDE.md` / `AGENTS.md` |

## 5. Anti-drift rules for the agent

- Reuse domain terms exactly as defined in `docs/GLOSSARY.md`.
- Before adding a concept, check whether it already exists (search the module);
  do not create a second `Participant`/`Payment` shape.
- If a doc and the code disagree, the code is reality — fix the doc in the same PR.
- Keep `CLAUDE.md`/`AGENTS.md` lean; push detail into `docs/`.
