# Interactive Genealogy Map Editor Rules

## Purpose

This document governs the interactive genealogy map, the public live site that renders it, and the authenticated admin/editor workspace used to modify it directly.

The product goal is a visual editor where an authorized administrator can select people, choose options, drag nodes, create or edit relationships, and see the resulting genealogy map update without leaving the diagram. Interaction simplicity must never bypass genealogy integrity, authorization, privacy, or database correctness.

This file extends `02-ARCHITECTURE.md`, `04-GENEALOGY-DOMAIN.md`, `05-SECURITY-PRIVACY.md`, `06-DATABASE-RULES.md`, `07-UI-UX-RULES.md`, and `08-TESTING-QUALITY-GATES.md`. When rules overlap, the stricter data-integrity or security rule wins.

## Language and runtime policy

The application should remain intentionally small in language count.

### Required application languages

- **TypeScript (`.ts`)** is the primary implementation language for domain logic, server actions, route handlers, validation, repositories/data access, editor commands, layout adapters, authorization helpers, tests, and shared infrastructure.
- **TSX (`.tsx`)** is used for React/Next.js UI, the live genealogy map, admin/editor panels, graph nodes, toolbars, dialogs, sheets, and interactive controls.
- **SQL (`.sql`)** is used for PostgreSQL/Supabase migrations, constraints, indexes, RLS policies, views, and transactional database functions when a database-side operation is the safest boundary.
- **CSS through Tailwind CSS and repository design tokens** is used for presentation. CSS must not become a business-logic or persistence layer.

### Configuration languages

- **YAML** is allowed for CI/CD and deployment configuration such as GitHub Actions.
- **JSON** is allowed for package/tool configuration and structured static metadata. JSON must not become the canonical genealogy database.

### Languages not in the baseline

Do not introduce Python, Go, Rust, Java, C#, or another backend runtime merely to make the system appear more scalable. Next.js server code plus Supabase/PostgreSQL is the default backend.

A new runtime language requires a documented architecture decision with:

1. a measured bottleneck or capability the current stack cannot solve cleanly,
2. deployment and operational ownership,
3. authentication/authorization boundaries,
4. data-consistency strategy,
5. rollback/removal cost,
6. tests proving the new service is necessary.

Web Workers used for expensive client-side layout calculations should still be written in TypeScript unless a measured requirement justifies WebAssembly.

## Product surfaces

The system has two distinct surfaces that may reuse the same genealogy rendering primitives.

### Public live site

- Public routes are read-only unless a product requirement explicitly introduces authenticated contribution.
- Public rendering must use server-authorized visibility rules and must never expose admin-only fields because a node component happens to contain them.
- The live map is a projection of canonical people and relationship data.
- Public viewers may pan, zoom, search, filter, select, inspect, and navigate without gaining mutation capability.
- When committed data changes, the public site may refresh through Next.js revalidation, normal refetching, or Supabase Realtime where justified. Realtime events are synchronization hints, not an authorization or correctness layer.

### Admin/editor site

- Editor routes require authenticated identity and an explicit editor/administrator capability.
- Authorization must be checked server-side for every mutation; hiding editor controls is not sufficient.
- The editor should reuse the public map presentation where practical, then layer editing controls on top rather than maintaining a separate incompatible renderer.
- Admin-only data must not be serialized into public page payloads.
- A service-role Supabase client must never be imported into browser code.

## Editor architecture

Keep these concerns separate:

```text
Genealogy domain data
  people + relationships + visibility
        |
        v
Projection / graph model
  renderable nodes + edges + derived labels
        |
        v
Layout state
  x/y positions + viewport + optional presentation preferences
        |
        v
Transient editor state
  selection + drag preview + hover + open menus + unsaved gesture state
```

Rules:

- Genealogy relationships are authoritative domain data.
- Graph nodes/edges are projections, not the source of truth.
- Node coordinates are presentation/layout state and must not redefine kinship.
- Selection, hover, drag previews, context menus, and temporary connection previews are transient client state and normally must not be persisted.
- A UI edge may represent a relationship, but deleting or drawing an edge must still execute an explicit validated domain mutation.
- Never infer a new family relationship merely from spatial proximity or node position.

## Direct manipulation rules

The editor should make common actions possible directly on the map while keeping mutation intent unambiguous.

### Selection

- Click/tap selects a node or relationship.
- Selection must have a strong visible state and a keyboard-accessible equivalent.
- Selecting a person may open an inspector, sheet, or side panel containing editable fields and relationship actions.
- Selection alone never writes to the database.

### Dragging people

- Dragging a person node changes only layout position unless the user explicitly enters a relationship-creation mode.
- Never mutate parent/child or partnership relationships because a node was dragged near another node.
- Visual movement during `pointermove` must remain local and frame-friendly.
- Persist final coordinates on drag end, not on every pointer event.
- If layout persistence fails, restore or clearly mark the previous persisted state; do not silently pretend the position was saved.

### Creating relationships

- Relationship creation must be explicit: for example, select a person, choose `Add parent`, `Add child`, or `Add partner`, then choose/connect the other person.
- A drag-to-connect gesture may be supported, but the relationship type must be explicit before commit.
- Show a connection preview before persistence.
- Validate genealogy invariants before commit, including self-links, duplicates, incompatible states, and parent/child cycle rules.
- Dangerous or unusually destructive rewiring must require confirmation proportional to impact.

### Editing fields and options

- Common categorical values should use accessible selects, comboboxes, radio groups, or menus rather than free text.
- Inline editing is allowed when the field is obvious and recovery is easy.
- Complex edits belong in a focused inspector/sheet rather than dense controls permanently attached to every node.
- Server validation remains authoritative even if the UI validates immediately.

### Pan and zoom

- Pan and zoom are view operations, never data mutations.
- Maintain stable pointer behavior: dragging canvas pans, dragging a node moves that node, and dragging a relationship handle previews a connection. Do not overload one gesture with ambiguous meanings.
- Provide keyboard-accessible navigation and controls for essential editor functions.

## Mutation command model

Interactive graph changes should be modeled as explicit commands/use cases rather than ad hoc component callbacks that write directly to Supabase.

Examples:

```text
MovePersonNode
UpdatePersonDetails
CreateParentChildRelationship
CreatePartnership
RemoveRelationship
MergeDuplicatePeople
ChangeVisibility
```

Each persistent command must define:

- authenticated actor,
- required capability,
- validated input schema,
- affected entity IDs,
- domain preconditions,
- transactional persistence behavior,
- structured success/error result,
- audit implications where relevant.

React components must call application/server mutation boundaries; they must not own raw database mutation logic.

## Save behavior and feedback

- Never write to PostgreSQL on every mouse/pointer movement.
- Persist node movement at gesture end and batch related updates when practical.
- Text fields may use explicit save or carefully designed debounce, but destructive/relationship mutations must commit only after clear user intent.
- The editor must expose `saving`, `saved`, `failed`, and conflict states when persistence is not instantaneous.
- Optimistic UI is allowed only when rollback/reconciliation is defined.
- A failed optimistic mutation must visibly return to the authoritative server state or present a recoverable conflict flow.

## Undo and redo

Once the editor supports meaningful persistent modification, undo/redo is a required design concern rather than an optional polish item.

- Model reversible editor actions as commands where practical.
- Layout moves should be undoable.
- Non-destructive data edits should be undoable when a safe inverse exists.
- Relationship deletion, person merge, and other high-impact operations require stronger recovery, audit, or confirmation semantics than a fragile client-only undo stack.
- Do not claim an operation is undoable if a refresh or second editor session would make that promise false.

## Concurrency and conflict handling

The admin editor must not silently overwrite another editor's newer changes.

- Mutable records should expose an `updated_at`, revision, or equivalent optimistic-concurrency marker when concurrent editing becomes possible.
- Mutations that depend on a previously read state should detect stale writes where practical.
- On conflict, refetch authoritative state and present a clear retry/reconcile path.
- Supabase Realtime may notify the editor that data changed elsewhere, but server/database validation remains the source of correctness.
- Do not implement collaborative cursors or CRDT infrastructure unless real simultaneous-editing requirements justify it.

## Backend and persistence rules

The backend exists to protect and persist the map, not merely to relay UI state.

- All persistent genealogy mutations must pass through a server action, route handler, or server-side use case.
- Validate inputs with explicit schemas at the server boundary.
- Check authorization before persistence.
- Use PostgreSQL transactions for multi-record changes that must succeed or fail together.
- Enforce database constraints and RLS in addition to application checks where possible.
- Prevent N+1 graph loading patterns.
- Recursive genealogy queries must be bounded and cycle-safe.
- Batch graph reads/writes where that meaningfully reduces latency without creating giant opaque endpoints.
- Do not use service-role access to avoid designing correct user permissions.

## Layout storage

Persist layout separately from genealogy meaning.

If manual positions are persisted, use a dedicated layout concept keyed to stable person/node IDs. Layout storage may include coordinates and optional layout metadata, but must not duplicate person/relationship records.

A user changing layout must not change lineage. A future automatic layout algorithm may replace coordinates without rewriting domain relationships.

If multiple layouts are introduced later, define their ownership and scope explicitly, such as a canonical public layout versus an editor-specific/private layout.

## Graph/rendering library policy

Do not hand-roll a full pan/zoom/node/edge interaction engine with raw DOM pointer code when a maintained graph library can satisfy the requirement.

Before adopting a graph library:

- verify React/Next.js compatibility,
- verify keyboard/accessibility capabilities or document gaps,
- verify large-graph rendering behavior,
- verify custom node/edge support,
- verify controlled state and persistence integration,
- isolate library-specific graph types behind feature/adaptor boundaries so genealogy domain code does not depend on the library.

The graph library may own interaction mechanics. It must not own genealogy business rules.

## Performance requirements

The editor must prioritize interaction responsiveness over rendering every possible detail at all times.

- Drag, pan, and zoom paths must avoid synchronous database/network work.
- Use `requestAnimationFrame`-friendly visual updates for pointer-driven movement.
- Avoid rerendering the entire graph when one selection or node position changes.
- Memoize or partition expensive graph projections when profiling shows benefit.
- Large maps should reduce offscreen detail, virtualize/cull where supported, or progressively reveal labels/media.
- Expensive automatic layout must not freeze the main thread; move sufficiently heavy layout work to a TypeScript Web Worker or server-side job when profiling proves it necessary.
- Do not add animation that competes with pointer responsiveness. Animate primarily `transform` and `opacity`.
- Image/media nodes must use bounded dimensions and optimized delivery.

A feature is not acceptable merely because it works on a tiny demo tree. Test against representative large synthetic datasets before declaring graph performance complete.

## Data loading strategy

- Load the minimum graph slice required for the current viewport/workflow when the full family graph becomes too large.
- Do not issue one request per visible person.
- Search and person inspection may lazy-load details that are not necessary for the initial graph projection.
- Prefer stable IDs and normalized data so updates can reconcile without rebuilding unrelated nodes.
- Keep browser caches as caches only; PostgreSQL remains authoritative.

## Authentication and route boundaries

A typical route shape may evolve toward:

```text
/                         public landing/live genealogy view
/person/[id]              public or permission-filtered person detail
/admin                    authenticated editor shell
/admin/tree               interactive map editor
/admin/people/[id]        focused person administration when needed
```

Exact routes are product decisions, but public and privileged capabilities must remain clearly separated.

Authentication setup must follow the repository Supabase SSR pattern. Token/session refresh behavior belongs at the server/proxy boundary, not in arbitrary components.

## Audit and destructive operations

As editing capability grows, persistent genealogy changes should become traceable.

At minimum, high-impact operations should have enough information to answer:

- who performed the change,
- what entities were affected,
- what type of operation occurred,
- when it occurred.

Person merge, bulk reparenting, bulk import, and hard deletion require explicit audit/recovery design before implementation.

Prefer soft archival or reversible state transitions over destructive deletion when the domain permits it.

## Accessibility requirements for the editor

Direct manipulation must never be mouse-only.

- Every essential operation needs a keyboard-accessible path.
- Selected node/edge state must be programmatically understandable.
- Drag-only operations require menu/form alternatives.
- Graph controls need accessible names.
- Focus must not disappear when a node is moved or the graph rerenders.
- Inspector/dialog focus management must follow repository accessibility rules.
- Color must not be the only indicator of relationship type or selection.

## Testing requirements

Interactive genealogy behavior requires layered tests.

### Unit/domain tests

Test:

- relationship invariants,
- graph projection helpers,
- command validation,
- layout-state transformations,
- undo/redo reducers or command inverses where implemented.

### Integration/database tests

Test:

- migrations,
- RLS/authorization cases,
- transactional multi-record mutations,
- relationship uniqueness and integrity constraints,
- cycle rejection where implemented at application/database boundaries.

### Playwright E2E tests

Critical editor journeys should cover:

1. unauthenticated user cannot access admin editor,
2. authorized editor can open the map,
3. selecting a node opens the expected inspector,
4. editing and saving a person persists after reload,
5. dragging a node persists layout after drag end,
6. creating a valid relationship persists after reload,
7. invalid relationship creation is rejected without corrupting the map,
8. failed/conflicting mutation produces a recoverable UI state,
9. public live view reflects committed permitted data,
10. keyboard alternatives exist for critical drag/select actions.

Use synthetic test genealogy data. Never place private production family data in fixtures.

## Definition of done for an editor feature

An interactive map/editor feature is not complete until all applicable statements are true:

- The UI behavior is understandable without hidden gestures.
- A keyboard-accessible alternative exists for essential actions.
- The browser does not directly own persistent mutation rules.
- Server-side validation and authorization are present.
- Domain invariants are enforced.
- Database/RLS behavior is correct.
- No pointer-move loop writes to the network/database.
- Loading, saving, error, conflict, and permission states are defined.
- Tests cover the changed behavior at the appropriate layers.
- Large synthetic graph behavior has been checked when rendering performance is affected.
- The public live site cannot acquire admin capability through shared components.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, relevant tests, and `npm run build` pass.

## Architecture escalation rule

Do not add a separate backend service, custom rendering engine, realtime collaboration system, WebAssembly module, global state framework, or background-job platform merely because the editor is complex.

Introduce new infrastructure only after profiling or product requirements demonstrate a concrete need, and document the decision before or with the implementation.
