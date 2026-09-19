# Admin Genealogy Editor Roadmap

## Release rule

All admin-editor steps in this roadmap are implemented, reviewed, and merged in GitHub before the next Vercel production deployment.

Automatic Vercel Git deployments are disabled through `vercel.json`. GitHub is the integration surface during development. The static GitHub Pages demo uses synthetic browser-only data and must never connect to production Supabase.

## Step 0 — Preview and editor contract

Goal: agree on interaction patterns before persistent mutations expand.

Deliverables:

- GitHub Pages static demo for admin workflows.
- Selection + inspector pattern.
- Explicit toolbar actions; no hidden genealogy mutations.
- Synthetic data only.
- Vercel Git auto-deployment disabled.

Exit criteria:

- Preview is reviewable on desktop and usable on tablet.
- Every proposed mutation has a visible, explicit action.
- No production database/network dependency exists in the preview.

## Step 1 — Person CRUD

**Status: complete in GitHub development stack; not deployed to Vercel production.**

Goal: admins can create and update individual records safely.

Add:

- Create person.
- Edit display name, description, birth/death year, sex metadata, visibility.
- Description is nullable and limited to 2,000 characters.
- Validation for unknown/partial values.
- Clear saving/saved/error feedback.

Server commands:

- CreatePerson
- UpdatePersonDetails (including description and visibility)

Tests:

- admin allowed;
- spectator rejected;
- malformed data rejected;
- changes survive reload.

## Step 2 — Relationship CRUD

**Status: complete in GitHub development stack; not deployed to Vercel production.**

Goal: explicitly manage canonical kinship relationships.

Add:

- Add parent.
- Add child.
- Add partner/spouse.
- Select an edge and inspect its type.
- Remove relationship with confirmation.
- Prevent duplicate/self/cyclic parent-child relationships.
- Persist only canonical parent-child and partnership edges; derived kinship/address labels are inferred from graph paths.
- Use known sex metadata only for direct display labels such as cha/mẹ, con trai/con gái, chồng/vợ; unknown sex stays neutral.

Server commands:

- CreateParentChildRelationship
- CreatePartnership
- RemoveRelationship

Tests:

- valid relationships persist;
- reverse duplicate partnership rejected;
- ancestry cycle rejected;
- removing an edge never deletes either person.

## Step 3 — Archive / restore and destructive-action safety

**Status: complete in GitHub development stack; not deployed to Vercel production.**

Goal: avoid dangerous hard deletes.

Add:

- Archive person.
- Restore archived person.
- Impact preview showing connected relationships before archival.
- Hide archived records from normal views with an admin filter to reveal them.
- Keep relationships and layout rows intact across archive/restore.
- Reject profile edits and new relationship mutations while a person is archived.
- Enforce archived-record hiding for spectator/anonymous access at RLS level.
- Revoke authenticated hard-delete permission for people.

Hard delete remains unavailable until an explicit recovery/audit design exists.

## Step 4 — Search, filter, focus, and branch navigation

Goal: make large trees administrable.

Add:

- Search by name/alias.
- Focus selected person.
- Filters: living/deceased, public/private, archived, generation branch.
- Jump to parents, children, partners.
- Collapse/expand branches without changing genealogy data.

## Step 5 — Layout administration

Goal: make manual layout a first-class presentation workflow.

Add:

- Existing drag-position persistence.
- Undo/redo for layout moves.
- Lock/unlock node position.
- Reset selected position.
- Reset branch layout.
- Auto-layout a selected branch.
- Fit/focus selection.
- Never infer kinship from proximity.

## Step 6 — Genealogical notes and provenance

Goal: distinguish recorded facts from evidence and uncertainty.

Schema/design:

- sources/citations;
- notes;
- confidence/certainty where appropriate;
- approximate/unknown dates without fabricating exact values.

Add:

- source list per person/relationship;
- add/edit/remove citation;
- display provenance in inspector;
- preserve conflicting claims instead of destructive overwrite where supported.

## Step 7 — Duplicate detection and merge review

Goal: resolve duplicate people without corrupting the graph.

Add:

- duplicate suggestions based on conservative signals;
- side-by-side review;
- explicit target/source merge;
- relationship migration preview;
- cycle/duplicate-edge validation;
- merge audit record.

No automatic merge.

## Step 8 — Audit log, undo model, and concurrency

Goal: make editing traceable and safe for multiple administrators.

Add:

- mutation audit entries: actor, command, affected IDs, timestamp;
- revision/updated_at stale-write checks;
- recoverable conflict UI;
- persistent undo where a safe inverse exists;
- stronger recovery flow for merge/archive/relationship removal.

## Step 9 — Data-quality dashboard

Goal: surface genealogy problems before publication.

Checks:

- missing parents or dates where noteworthy;
- impossible/suspicious chronology;
- duplicate candidates;
- isolated people;
- private living-person exposure;
- relationships with incomplete provenance.

These are review signals, not automatic corrections.

## Step 10 — Bulk utilities and release preparation

Add only after single-record workflows are stable:

- structured import preview;
- export/backup;
- batch visibility changes with impact review;
- large synthetic graph performance test;
- keyboard-accessibility pass;
- full Playwright admin journeys.

## Final release gate

Before the next Vercel deployment:

1. Every step above intended for the release is merged to `main`.
2. Full CI is green on `main`.
3. Supabase migrations are applied and migration history matches the repo.
4. Security and performance advisors are reviewed.
5. Admin and spectator E2E tests pass.
6. Production rollback point is identified.
7. Vercel deployment inventory is pruned to <= 9 before deployment.
8. Deploy manually to Vercel.
9. Run production smoke tests.
10. Prune deployment inventory again to <= 10.
