# Vercel Deployment Retention Rules

## Purpose

Vercel deployment history must remain intentionally bounded. Stale previews, failed builds, and superseded production deployments consume deployment storage and make rollback history harder to reason about.

This repository therefore treats deployment cleanup as part of every Vercel deployment workflow rather than as occasional maintenance.

## Hard ceiling and operating target

- Hard ceiling: **never intentionally retain more than 10 deployments for this Vercel project at one time**.
- Pre-deploy gate: before creating a new deployment, the project must contain **9 or fewer retained deployments**.
- Preferred steady-state target: keep **8 or fewer deployments** after cleanup when doing so does not remove an explicitly needed rollback or investigation artifact.
- If safe cleanup cannot reduce the project below the pre-deploy gate, **do not start another deployment**. Resolve the retention conflict first.
- A build or retry does not create an exception to the ceiling. Make room before triggering it.

The count applies across production, preview, temporary/draft-style, failed, canceled, and other retained deployment records belonging to this project.

## Cleanup priority

When space is required, prune in this order:

1. Terminal failed, error, or canceled deployments.
2. Temporary/draft or preview deployments that are no longer under active review.
3. Superseded preview deployments from branches or commits that already have a newer preview.
4. Old successful production deployments, oldest first, while preserving the current production deployment and the newest useful rollback candidates.

Do not keep a failed or obsolete preview deployment merely because it is recent.

## Protected deployments

Never delete:

- the deployment currently serving production;
- a deployment still in a queued, initializing, or building state;
- a deployment explicitly selected for an active rollback;
- a deployment required for an ongoing incident investigation;
- a deployment whose removal would break an intentionally retained active alias/domain.

Once a rollback or investigation is complete, the deployment loses that temporary protection and returns to the normal retention policy.

## Production rollback retention

The current production deployment is always protected.

Previous successful production deployments may be kept as rollback candidates only within the 10-deployment hard ceiling. Prefer the newest useful rollback candidates and delete the oldest superseded production deployments first when capacity is needed.

Rollback convenience must not cause unbounded retention.

## Preview retention

Preview deployments are disposable unless they are actively being reviewed.

- Keep at most the newest preview that is still needed for a branch/commit review.
- Delete superseded previews after a newer preview proves healthy.
- Delete abandoned branch previews promptly.
- Delete temporary/draft-style deployments once their inspection purpose is complete.
- Do not use preview deployments as long-term archives.

## Failed deployment retention

Failed, error, and canceled deployments are diagnostic artifacts, not rollback candidates.

After the relevant logs or failure cause have been captured, delete the deployment. Do not leave repeated failed attempts accumulating in the project history.

If a failed deployment is temporarily retained for investigation, mark that reason in the task/PR context and remove it when the investigation ends.

## Required deployment workflow

### Before deployment

1. Confirm the target Vercel project.
2. List existing deployments for that project only.
3. Identify the current production deployment and protect it.
4. Remove terminal failed/error/canceled deployments that are no longer under investigation.
5. Remove obsolete preview/draft deployments.
6. If needed, remove the oldest superseded successful deployments.
7. Confirm the retained deployment count is **9 or fewer** before triggering the new deployment.
8. Confirm the branch/commit and environment are correct.

### After deployment

1. Confirm the new deployment reaches its intended terminal state.
2. If it becomes the current production deployment, protect it and demote the prior production deployment to an ordinary rollback candidate.
3. Remove failed retries and superseded previews created during the deploy cycle.
4. Recount deployments.
5. Enforce the **10-deployment hard ceiling** and return toward the preferred **8-or-fewer steady state**.

### After rollback

1. Confirm which deployment is now serving production.
2. Protect the active production deployment.
3. Remove temporary failed/retry deployments generated during the incident when no longer needed.
4. Apply the normal cleanup priority and ceiling again.

## Safety requirements

- Scope every destructive cleanup operation to the intended Vercel project. Never run account-wide deletion logic.
- Inspect deployment identity, environment, creation time, state, commit/branch metadata, and active aliases before deletion.
- Prefer explicit deployment IDs over ambiguous name matching.
- Never delete deployments concurrently when the protected/current-production identity is uncertain.
- Never delete the current production deployment merely to satisfy the count; delete lower-priority artifacts instead.
- If Vercel state is ambiguous or a deployment cannot be classified safely, leave it intact and stop before creating another deployment.
- Cleanup tools/scripts must be idempotent: rerunning them should not endanger protected deployments.

## Automation rule

Any future deployment automation, GitHub Action, CLI script, or AI-agent workflow that creates Vercel deployments must include a retention check or invoke a cleanup step that enforces this document.

A deployment workflow that continuously creates deployments without cleanup is non-compliant even if individual deployments succeed.

## Definition of done

A Vercel deployment task is not complete until:

- the intended deployment state is verified;
- the active production deployment is identified correctly;
- obsolete failed/preview/draft deployments have been removed;
- stale successful deployments have been pruned when required;
- the project retains no more than 10 deployments;
- no protected deployment was deleted.
