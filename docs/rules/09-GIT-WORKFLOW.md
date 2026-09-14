# Git and Change Workflow

## Goal

Keep repository history reviewable, reversible, and understandable to both humans and AI agents.

## Branches

- `main` is the deployable integration branch.
- Non-trivial work should normally happen on a focused feature/fix branch.
- Recommended branch prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`.
- One branch should represent one coherent change set. Avoid mixing unrelated cleanup into feature work.

## Commits

Write small, atomic commits that leave the repository in a coherent state.

Recommended Conventional Commit style:

```text
feat: add person profile editor
fix: prevent cyclic parent relationship
docs: define genealogy domain rules
refactor: extract relationship validator
test: cover living-person access policy
chore: update lint configuration
```

A commit message should describe the outcome, not the act of typing code.

## Pull requests

A pull request should explain:

- what changed,
- why it changed,
- relevant architecture/domain decisions,
- security or migration impact,
- tests/checks run,
- screenshots for meaningful UI changes when useful,
- known limitations or follow-up work.

Keep PRs small enough to review. If a change combines schema redesign, UI redesign, auth changes, and broad refactoring, split it unless those pieces are inseparable.

## Database changes

Schema changes and the application code that depends on them must be coordinated. PRs containing migrations must identify:

- migration purpose,
- compatibility assumptions,
- data-loss risk,
- rollback/recovery approach for destructive operations,
- RLS/policy changes.

## Generated files

Do not commit local build outputs, dependency directories, secret environment files, editor artifacts, or generated caches. Generated artifacts should only be committed when the repository intentionally treats them as source-controlled deliverables.

## AI-generated changes

AI-generated code receives the same review standard as human-written code. An AI agent must not:

- make unrelated cleanup changes,
- rewrite large files to make a tiny change,
- claim tests passed without running them,
- bypass failing checks by weakening configuration,
- introduce a dependency without a concrete reason,
- alter architecture without updating the corresponding rule documentation.

## Before merge

Confirm, when applicable:

- lint passes,
- TypeScript passes,
- tests pass,
- production build passes,
- migration is reviewed,
- RLS/authorization behavior is reviewed,
- no secrets or private production data are present,
- relevant `docs/rules/` documentation remains accurate.

## Emergency fixes

A production hotfix may be narrower than the normal workflow, but security, authorization, genealogy invariants, and data-integrity checks may not be skipped. Any deliberately deferred cleanup must become an explicit follow-up task rather than silently remaining undocumented.