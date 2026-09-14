# Testing and Quality Gates

## Principle

Tests protect genealogy correctness, authorization, and maintainability. A change that modifies behavior should normally modify or add tests at the same time.

## Test layers

Use the cheapest layer that can prove the requirement:

1. Unit tests for pure domain rules and utilities.
2. Integration tests for database behavior, authorization, RLS, route handlers, and server actions.
3. End-to-end tests for critical user journeys.

Do not rely on E2E tests for logic that can be tested deterministically at unit level.

## Mandatory high-value tests

As the corresponding functionality is implemented, maintain tests for:

- preventing self parent/child relations,
- preventing ancestry cycles,
- preventing duplicate relationship edges,
- preventing self partnership,
- person date validation,
- role/capability authorization,
- living-person privacy rules,
- RLS policies,
- safe relationship deletion,
- duplicate-person merge behavior if merging is introduced,
- family traversal depth/cycle safety.

## UI tests

Test observable user behavior rather than component implementation details.

Critical forms should cover:

- valid submission,
- invalid data,
- server failure,
- permission denial,
- loading/submitting state,
- keyboard-accessible interaction where practical.

## End-to-end smoke paths

When E2E infrastructure exists, production-critical smoke coverage should include at least:

- app loads,
- sign-in flow,
- authorized person creation/edit,
- relationship creation,
- family-tree rendering,
- unauthorized mutation rejection.

## Regression rule

Every confirmed bug should receive a regression test when reasonably automatable. The test should fail before the fix and pass after it.

## Test data

Use synthetic deterministic fixtures. Do not place private real-family information in repository tests or CI logs.

## Quality gates before completion

AI agents and contributors should run the repository-equivalent commands for:

```text
format/check
lint
typecheck
test
build
```

If the project later defines canonical scripts, those scripts supersede these generic names.

A task may be reported complete only when applicable checks pass, or when the response explicitly lists checks that could not be executed and why.

## No test theater

- Do not weaken assertions solely to make a failing test pass.
- Do not delete valid tests because implementation changed unexpectedly.
- Do not mock the behavior under test.
- Do not mark tests skipped without a documented reason.
- Coverage percentage is not a substitute for testing important invariants.