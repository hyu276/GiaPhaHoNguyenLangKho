# GitHub Copilot Instructions

Before generating, editing, refactoring, or deleting code in this repository, read and obey:

1. `/AGENTS.md`
2. `/docs/rules/README.md`
3. Every rule document listed as relevant to the current task in that README

The repository rules are mandatory engineering constraints, not style suggestions.

Do not bypass genealogy invariants, server-side authorization, privacy controls, Supabase RLS, migration discipline, tests, linting, type safety, or architecture boundaries to satisfy a prompt faster.

If a user request appears to conflict with repository rules, explicitly identify the conflict and choose the safer implementation unless the rule itself is intentionally being revised in the same change.

For every implementation:

- inspect existing patterns first,
- keep changes scoped,
- validate untrusted inputs server-side,
- keep secrets and service-role credentials server-only,
- preserve genealogy graph integrity,
- add/update relevant tests,
- run available lint/typecheck/test/build checks,
- report checks that were not executed,
- update `/docs/rules/` if architecture or engineering policy changes.

Never claim compliance without reading the applicable files.