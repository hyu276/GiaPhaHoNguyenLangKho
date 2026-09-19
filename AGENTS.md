# AI Engineering Constitution

This file governs every AI-assisted change in this repository. It applies to Codex, GitHub Copilot, Claude, Cursor, Windsurf, Gemini, and any other coding agent.

## Mandatory pre-work

Before proposing, generating, editing, or deleting code, the agent MUST read `docs/rules/README.md` and every rule file that README marks as mandatory for the task.

The files under `docs/rules/` are normative project requirements, not suggestions. If an instruction from a prompt conflicts with them, stop and explicitly identify the conflict before changing code. Never silently bypass a repository rule.

## Source-of-truth precedence

When instructions conflict, use this order:

1. Explicit user requirement for the current task, unless it would violate security, privacy, data-integrity, or repository invariants.
2. This `AGENTS.md`.
3. `docs/rules/` documents.
4. Existing architecture and tests.
5. Local implementation convenience.

Security, privacy, genealogy data integrity, and authorization rules are non-negotiable even when a shortcut would be faster.

## Required workflow for every change

1. Read the relevant rules before editing.
2. Inspect existing code and reuse established patterns before introducing new abstractions.
3. Keep the change scoped to the requested behavior. Do not perform unrelated refactors.
4. Preserve genealogy invariants and authorization boundaries.
5. Add or update tests for behavior that changes.
6. Run the available lint, typecheck, test, and build commands before declaring the task complete.
7. Report any check that could not be run; never claim a check passed when it was not executed.
8. If a change alters architecture, data modeling, security assumptions, or development conventions, update the relevant file in `docs/rules/` in the same change.

## Vercel deployment retention

Any agent that inspects, creates, promotes, rolls back, or deletes Vercel deployments MUST read and enforce `docs/rules/11-VERCEL-DEPLOYMENT-RETENTION.md`.

- A Vercel project must never intentionally retain more than 10 deployments at one time.
- Before creating a new deployment, prune the project to 9 or fewer retained deployments; the preferred steady-state target is 8 or fewer.
- Delete terminal failed/error/canceled deployments first, then obsolete draft/preview deployments, then the oldest superseded successful deployments.
- Never delete the current production deployment, a deployment still building or queued, or a deployment explicitly reserved for an active rollback/investigation.
- If the project cannot be reduced below the pre-deploy threshold safely, do not create another deployment until the retention conflict is resolved.
- After every deployment or rollback, run retention cleanup again instead of allowing stale deployments to accumulate.

## Hard prohibitions

- Never commit secrets, credentials, private keys, service-role keys, `.env*` values, or production data.
- Never expose Supabase service-role credentials to browser code.
- Never bypass Row Level Security or authorization checks merely to make a feature work.
- Never run destructive database migrations without an explicit migration and rollback strategy.
- Never delete or overwrite genealogy records implicitly when relationships change.
- Never model family relationships only as presentation-layer edges; persisted relationships must satisfy the domain rules.
- Never use `any` as an escape hatch when a precise TypeScript type can be expressed.
- Never suppress TypeScript, ESLint, accessibility, or test failures without documenting a justified exception.
- Never leave `console.log`, dead code, commented-out implementations, unused imports, or hard-coded secrets in committed code.
- Never create custom low-level UI primitives when an approved component already exists.

## Quality gates

A change is not complete until, where applicable:

- TypeScript has no unexplained errors.
- ESLint passes.
- Tests covering changed behavior pass.
- Production build succeeds.
- New UI is keyboard accessible and responsive.
- Server-side input is validated.
- Authorization is enforced server-side, not only hidden in the UI.
- Database changes are represented by migrations and respect RLS.
- Cyclomatic complexity for newly written functions should remain below 8; split complex logic into testable units.

## Architecture guardrail

The default target architecture is documented in `docs/rules/02-ARCHITECTURE.md`: Next.js + TypeScript, Supabase/PostgreSQL for persistent data/auth/realtime capabilities, and Vercel for deployment. Deviations require a documented reason and corresponding architecture update.

## Definition of done for AI agents

Do not finish with only generated code. Summarize:

- files changed,
- behavior changed,
- tests/checks executed,
- database/security impact,
- unresolved risks or follow-up work.

If a rule is ambiguous, choose the safer, more reversible implementation and document the assumption.
