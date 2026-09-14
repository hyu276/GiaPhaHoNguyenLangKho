# Database and Supabase Rules

## Source of truth

PostgreSQL is the authoritative persistent store for genealogy and application state. Client caches, local storage, generated tree structures, and UI layout state must never become competing sources of truth.

## Schema design

- Use stable generated IDs for primary keys.
- Model people and relationships in separate tables rather than embedding mutable relationship arrays in person rows.
- Use foreign keys for referential integrity.
- Use unique constraints for relationships that must not duplicate.
- Use check constraints for simple invariants that PostgreSQL can enforce safely.
- Use timestamps consistently (`created_at`, `updated_at`) for mutable records where operationally useful.
- Prefer explicit status/visibility columns over ambiguous booleans when states may evolve.

## Suggested conceptual tables

The exact schema may evolve, but the initial model should likely include concepts equivalent to:

- `profiles` or application users,
- `people`,
- `parent_child_relationships`,
- `partnerships`,
- optional `sources` / `citations`,
- optional audit/moderation tables as the product matures.

Do not create tables simply because they appear in this document; create them when required by implemented behavior.

## Migrations

- Every schema change must be represented by a versioned migration in `supabase/migrations/`.
- Never rely on undocumented manual production changes.
- Migrations should be deterministic and reviewable.
- Destructive migrations require an explicit data-preservation or rollback plan.
- Prefer additive/backward-compatible migrations when practical.
- Do not rewrite an already-applied production migration; create a new corrective migration.

## Row Level Security

- RLS is expected for tables reachable through Supabase's public/authenticated clients.
- Policies must implement least privilege.
- Public visibility must be explicit, especially for living-person records.
- Test RLS for anonymous, ordinary authenticated, editor, and administrative scenarios when those roles exist.
- Never use service-role access in client-side code.

## Transactions

Operations that must succeed or fail as one genealogy change should execute transactionally when possible. Examples include a future merge operation that rewires multiple relationships.

Do not leave partially updated genealogy graphs after a failed multi-step operation.

## Relationship constraints

Database constraints should enforce what they can reliably express, such as:

- no self parent/child relation,
- no duplicate directed parent/child edge,
- no self partnership,
- normalized/unique partnership pair when partnership endpoint order is semantically irrelevant.

Cycle detection generally requires application/database logic beyond a basic check constraint and must still be validated before committing a new parent-child edge.

## Query design

- Avoid unbounded recursive genealogy traversal.
- Recursive CTEs must include cycle protection and practical depth/size constraints.
- Avoid N+1 query patterns for family tree rendering.
- Add indexes based on measured/common query patterns, especially relationship endpoints and searchable person fields.
- Do not index every column preemptively.

## Generated and derived data

Derived genealogical facts should not be independently editable. If materialized views or caches are later introduced, document refresh/invalidation behavior and keep canonical relationships authoritative.

## Seed and test data

Development/CI seed data must be synthetic or explicitly safe for public development use. Do not copy private production family data into repository fixtures.

## Backups and destructive operations

Before production hard-delete, bulk import, merge, or schema transformation features are introduced, define backup/restore expectations and failure behavior. Historical genealogy data should be treated as difficult to reconstruct.