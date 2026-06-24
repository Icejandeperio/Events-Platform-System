# Contributing & Workflow

Applies to human engineers and AI agents alike. The goal is a codebase any
engineer can read cold and extend without creating spaghetti.

## Branching

- `main` is always deployable. No direct commits.
- Branch per task: `feat/<scope>-<short-desc>`, `fix/...`, `docs/...`, `refactor/...`, `chore/...`.
- Open a PR early; keep PRs small and single-purpose.

## Commits — Conventional Commits (required)

Format: `type(scope): subject`

```
feat(payments): add manual screenshot adapter behind PaymentProvider port
fix(auth): reject session when tenant context is missing
docs(security): document file-upload validation rules
refactor(core): extract registration policy from controller
chore(ci): add dependency-cruiser to lint step
```

- **Types:** `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Scopes:** module names — `core`, `payments`, `registration`, `participants`,
  `tenancy`, `auth`, `entitlements`, `dashboard`, `ui`, `db`, `ci`.
- Breaking change: add `!` (`feat(api)!: ...`) and a `BREAKING CHANGE:` footer.
- `commitlint` enforces this on commit; the message is rejected if malformed.
- `CHANGELOG.md` is generated from commits by `release-please` — never hand-edit it.

## The documentation loop (every change)

Before you push, confirm:
1. **TSDoc** added/updated on every touched exported symbol.
2. **Conventional Commit** written.
3. **ADR** added if an architectural decision was made (`docs/adr/`).
4. Relevant **`docs/` page** updated if a contract/behavior changed.

## Pull requests

- Use `.github/pull_request_template.md` (auto-populated).
- PR must pass CI: `lint`, `typecheck`, `test`, `dependency-cruiser`, secret scan.
- PR description states: what changed, why, which docs/ADRs were updated, and how it was tested.
- At least one review (human) before merge to `main`. Squash-merge; the squash
  message must be a valid Conventional Commit.

## Definition of Done

See `docs/DEFINITION_OF_DONE.md`. A PR is not mergeable until every box is checked.

## Local hooks

Husky + lint-staged run on commit:
- `prettier --write`, `eslint --fix`, `tsdoc` check on staged files
- `commitlint` on the message
- Gitleaks secret scan

If a hook fails, fix the cause — do not bypass with `--no-verify`.
