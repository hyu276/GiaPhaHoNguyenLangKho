# Repository Rules Index

This directory is the normative rule set for `GiaPhaHoNguyenLangKho`.

All human contributors and AI coding agents must treat these documents as engineering requirements. `AGENTS.md` at the repository root defines how AI agents must consume and enforce them.

## Mandatory reading matrix

| File | Purpose | Read when |
|---|---|---|
| `01-PRODUCT-RULES.md` | Product scope and behavioral principles | Every feature task |
| `02-ARCHITECTURE.md` | System boundaries and dependency direction | Every implementation or refactor |
| `03-CODE-QUALITY.md` | TypeScript, naming, complexity, imports, maintainability | Every code change |
| `04-GENEALOGY-DOMAIN.md` | Family-tree domain model and invariants | Any person/relationship/tree feature |
| `05-SECURITY-PRIVACY.md` | Authentication, authorization, privacy, secrets | Every data/API/auth task |
| `06-DATABASE-RULES.md` | PostgreSQL/Supabase schema, migrations, RLS | Any persistence change |
| `07-UI-UX-RULES.md` | Accessibility, responsive behavior, genealogy visualization | Any UI task |
| `08-TESTING-QUALITY-GATES.md` | Tests and completion gates | Every behavior-changing task |
| `09-GIT-WORKFLOW.md` | Branch/commit/PR discipline | Any repository change |

## Global rules

1. Prefer correctness, data integrity, privacy, and reversibility over implementation speed.
2. Keep business/domain logic separate from rendering and infrastructure code.
3. Never create a second source of truth for genealogy data.
4. Every persistent mutation must be authorized server-side and validated before database execution.
5. Schema changes require migrations. Never manually mutate production schema as an undocumented shortcut.
6. Architecture documentation must be updated whenever a change intentionally violates or evolves an existing boundary.
7. New abstractions must earn their existence by reducing duplication or clarifying a domain boundary; avoid speculative infrastructure.

## Rule changes

Changing these documents is itself an architectural change. A rule update should explain why the previous rule no longer serves the project and should be committed together with the implementation that requires it.