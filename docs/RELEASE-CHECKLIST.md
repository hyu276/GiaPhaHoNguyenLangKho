# Admin Editor Release Checklist

This checklist is for the first production release after Steps 0–10 are merged.

## 1. Git integration gate

- Merge the canonical PR stack in dependency order.
- Confirm `main` has no open conflict with the release stack.
- Run the full GitHub Quality workflow on `main`.
- Confirm format, lint, typecheck, unit tests, production build, Chromium install, and E2E all pass.

## 2. Database gate

- Compare Supabase migration history with `supabase/migrations`.
- Apply pending migrations in order.
- Confirm the Step 10 batch visibility RPC exists and is executable only by authenticated users after its internal admin check.
- Review Supabase security and performance advisors.
- Verify RLS still hides archived/private data according to the existing spectator contract.

## 3. Backup and rollback gate

- Create a fresh admin JSON backup before production mutation/deployment.
- Record the current production deployment ID as the rollback point.
- Confirm the previous stable Vercel deployment is still available.
- Do not execute structured imports in this release; Step 10 import remains preview-only.

## 4. E2E gate

Provide release-only credentials through:

- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

Run the Playwright suite and confirm:

- public home smoke;
- admin login keyboard journey;
- authenticated admin Step 10 journey;
- import/backup dialog opens;
- batch visibility impact review opens without applying a mutation;
- data-quality dashboard opens;
- sign-out remains visible.

No persistent mutation is required by the release E2E journey.

## 5. Performance and accessibility gate

- Run the 2,000-person synthetic graph benchmark.
- Confirm the benchmark stays below the repository release budget.
- Keyboard-tab through admin login.
- Confirm dialogs expose accessible names and close controls.
- Check focus visibility at desktop and tablet widths.

## 6. Vercel release gate

- Prune deployment inventory to <= 9 before deployment.
- Deploy manually only after GitHub + Supabase gates are green.
- Run production smoke tests.
- Verify admin and spectator access separately.
- Verify no unexpected Supabase egress spike.
- Prune deployment inventory again to <= 10.

## 7. Release stop conditions

Stop the release if any of the following is true:

- GitHub Quality is not green on `main`;
- migration history differs from the repository;
- Supabase advisor reports an unresolved critical security issue;
- authenticated E2E cannot complete;
- backup creation fails;
- rollback deployment is unavailable;
- production smoke tests detect stale-write, RLS, or visibility regressions.
