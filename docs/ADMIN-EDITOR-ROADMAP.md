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

**Status: complete in GitHub development stack; not deployed to Vercel production.**

Goal: make large trees administrable.

Add:

- Search by display name. Alias search remains deferred until alias data exists in the canonical person model.
- Focus selected person without changing saved layout coordinates.
- Filters: living/deceased, public/private, active/all/archived.
- Jump to parents, children, and partners from the selected-person inspector.
- Collapse/expand descendant branches without changing genealogy data or persisted layout.
- Keep traversal cycle-safe even if malformed historical data is encountered.
- Keep all filtering/navigation local to the already-authorized graph payload; no new database queries or mutations are introduced.

Current life-status filter semantics use the existing model: a recorded death year means deceased; no recorded death year is treated as living for this editor filter. A future explicit life-status field can replace this heuristic without changing the navigation contract.

## Step 5 — Layout administration

**Status: complete in GitHub development stack; not deployed to Vercel production.**

Goal: make manual layout a first-class presentation workflow.

Add:

- Preserve existing drag-position persistence and extend writes to validated layout batches.
- Undo/redo up to the latest 50 successful layout mutations in the current editor session.
- Lock/unlock node position for the current editor session; locked nodes cannot be dragged and are skipped by reset/auto-layout operations.
- Reset a selected unlocked active person to the deterministic fallback grid position.
- Reset a selected descendant branch to deterministic fallback positions while preserving locked and archived nodes.
- Auto-layout descendants by genealogy generation beneath the selected root while keeping the root as the visual anchor.
- Reuse focus/fit selection from Step 4 without writing layout coordinates.
- Keep all layout operations presentation-only and never infer kinship from proximity.
- Persist successful reset, auto-layout, undo, and redo operations through the same admin-only `person_layouts` write path.
- Require no schema migration for this step; layout locks and history intentionally reset on page reload.

Tests:

- deterministic fallback positions;
- selected-branch membership follows directed parent-child edges only;
- auto-layout groups descendants by generation and preserves the root anchor;
- locked descendants are excluded from automatic movement;
- partnership edges never create descendant generations.

## Step 6 — Genealogical notes and provenance

**Status: complete in GitHub development stack; not deployed to Vercel production.**

Goal: distinguish recorded facts from evidence and uncertainty.

Schema/design:

- reusable `genealogy_sources` records for family books, civil records, archives, oral history, photos, publications, web sources, and other source types;
- `genealogy_citations` linking exactly one source to exactly one person or canonical relationship;
- claim kind + claim text + locator + research note;
- explicit certainty values: certain / probable / possible / unknown;
- optional date expression + qualifier for exact/about/before/after/range/unknown dates without coercing uncertain dates into canonical exact year fields;
- conflicting citations intentionally coexist; no uniqueness rule silently chooses a winner.

Add:

- source list per person/relationship;
- create/update reusable source metadata;
- add/edit/remove citation;
- display provenance in inspector;
- preserve conflicting claims instead of destructive overwrite;
- prevent relationship deletion from silently discarding attached citations.

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
