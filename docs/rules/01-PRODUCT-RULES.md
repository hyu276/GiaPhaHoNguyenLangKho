# Product Rules

## Mission

Build a trustworthy, maintainable web application for creating, browsing, and preserving the genealogy of the Nguyen family of Lang Kho. The product must favor historical accuracy, traceability, privacy, and long-term maintainability over decorative complexity.

## Product principles

- Genealogy data is historical data, not disposable UI state.
- A person may have incomplete or uncertain information. The system must support unknown values without inventing facts.
- Relationships must be explicit and explainable.
- Destructive actions must be deliberate, confirmed, authorized, and recoverable where practical.
- Private living-person information must not become public by default.
- The tree visualization is a view of the underlying domain model, not the domain model itself.
- The application should remain usable on desktop, tablet, and mobile, even if dense tree editing is optimized for larger screens.

## Initial functional scope

The first production-ready versions should center on:

1. Authentication and user roles.
2. Creating and editing people.
3. Creating and editing parent/child and partner/spouse relationships.
4. Browsing a family tree interactively.
5. Searching and filtering people.
6. Viewing a person's profile and immediate family context.
7. Tracking provenance/notes for genealogical facts where relevant.
8. Privacy controls for sensitive records.
9. Safe administrative workflows for correction and moderation.

Features such as social feeds, chat, gamification, unrelated CMS functionality, or ornamental animation are out of scope unless explicitly requested.

## Data entry rules

- Never require a historically unknown field simply to satisfy UI convenience.
- Distinguish `unknown` from empty user input when the difference matters.
- Dates may be exact, partial, approximate, or unknown if the domain model supports them.
- Names must not be silently normalized in a way that destroys diacritics, aliases, generational names, or historical spelling.
- Duplicate detection should assist users but must not auto-merge records without an explicit reviewed action.
- Relationship edits must be validated against genealogy invariants before persistence.

## Product behavior

- Every mutation should return a clear success or actionable error state.
- Empty states should explain the next valid action.
- Avoid hidden side effects. A relationship change must not silently rewrite unrelated genealogy data.
- Prefer reversible archive/soft-delete workflows for important historical records over irreversible deletion when feasible.
- Administrative privileges must not be inferred from UI visibility; they must be enforced server-side.

## Internationalization and content

Vietnamese is the primary product language unless a feature explicitly introduces multilingual support. Store canonical data independently from presentation labels so English or other locales can be added without schema redesign.