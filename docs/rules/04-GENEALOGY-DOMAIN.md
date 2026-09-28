# Genealogy Domain Rules

## Purpose

Genealogy is graph-shaped historical data. The application must protect domain correctness independently from how the tree is drawn on screen.

## Core entities

At minimum, model these concepts explicitly:

- `Person`: an individual historical or living person.
- `ParentChildRelationship`: a directed relationship from parent to child.
- `Partnership`: marriage/spouse/partner relationship between two people, with optional historical metadata.
- `Source` or provenance metadata when factual claims need attribution.

Do not persist a UI tree layout as the canonical representation of family relationships.

## Identity

- Every person has a stable immutable internal ID.
- Names are attributes, not identifiers.
- Two people with the same name must remain distinct records unless explicitly merged.
- Never reuse a deleted person's ID for another person.

## Parent-child invariants

- A person cannot be their own parent or child.
- Parent-child relationships are directed.
- The ancestry graph must remain acyclic. Creating a relationship that makes a person their own ancestor or descendant is invalid.
- Duplicate parent-child edges are invalid.
- Removing a parent-child relationship must remove only that relationship; it must not implicitly delete either person.
- Do not assume every person has exactly two recorded parents. Historical data can be incomplete and domain extensions may include adoptive/step/guardian concepts later.
- Biological, adoptive, step, guardian, or other relationship semantics must not be conflated if/when those types are introduced.

## Partnership invariants

- A person cannot be partnered with themselves.
- The same logical partnership must not be duplicated merely because endpoint order is reversed.
- Partnership is not equivalent to parenthood. Creating a spouse/partner relation must never implicitly create parent-child relations.
- Former, uncertain, historical, or multiple partnerships must remain representable if the historical record requires them.

## Temporal consistency

When dates exist, validate obvious contradictions without pretending incomplete history is exact.

Examples of invalid or suspicious data that should be rejected or flagged according to certainty:

- birth date after death date,
- exact child birth date before an exact parent birth date,
- exact partnership end before exact partnership start.

Do not manufacture missing dates to satisfy validation.

## Unknown, approximate, and disputed data

Historical genealogy contains uncertainty. The model must distinguish known data from assumptions.

- Unknown values should remain unknown.
- Approximate dates must not silently become exact dates.
- Conflicting historical claims should be resolvable through provenance/notes rather than destructive overwriting when the product supports sources.
- UI labels such as “không rõ” are presentation concerns; storage should use explicit nullable/structured semantics.

## Provenance and citations

When provenance is implemented:

- A reusable source record describes the underlying tư liệu; a citation links one source to exactly one person or one canonical relationship.
- Citations may record the claim type, verbatim/normalized claim text, locator, research note, certainty, and an optional date expression.
- Approximate, ranged, before/after, or unknown date claims must remain explicit provenance data unless an administrator separately promotes a sufficiently supported exact value into the canonical person fields.
- Adding a lower-certainty or conflicting citation must never silently overwrite canonical person/relationship data.
- Multiple conflicting citations may coexist. Resolution is an explicit review decision, not a uniqueness constraint.
- Certainty is recorded evidence context, not an automatically computed truth score.
- Removing a citation removes only that citation. It must not delete the target person, relationship, or shared source.

## Deletion and merging

Person deletion is high-impact because relationships may depend on the record.

- Prefer archive/soft-delete for historically important records where practical.
- Hard deletion must explicitly consider all inbound/outbound relationships.
- Do not cascade-delete relatives.
- Merging duplicate people must be an explicit reviewed operation, migrate relationships deterministically, prevent duplicate edges/cycles, and retain an audit trail if audit infrastructure exists.

## Traversal and tree rendering

A family can be rendered from different focal persons. Therefore:

- Never assume there is one universal visual root.
- Ancestor and descendant traversal must protect against malformed cyclic data even though writes should prevent cycles.
- Graph traversal should have explicit depth/size controls for expensive queries or UI rendering.
- Layout coordinates are ephemeral presentation state unless a future feature explicitly persists user-defined layouts.

## Derived facts

Sibling, grandparent, grandchild, ancestor, descendant, generation distance, and similar facts should normally be derived from canonical relationships rather than duplicated as independently editable records.

If a derived value is cached for performance, canonical relationships remain the source of truth and cache invalidation must be defined.

## Validation location

Critical invariants must be enforced as close to persistence as practical, not only in client UI. Client validation improves UX but is never the only protection for genealogy integrity.