# Code Quality Rules

## TypeScript

- Use strict TypeScript.
- Prefer precise domain types over primitive strings/numbers when ambiguity is possible.
- Avoid `any`. Use `unknown` plus validation/narrowing at untrusted boundaries.
- Do not silence compiler errors with broad casts. A type assertion must reflect a real invariant the code establishes.
- Prefer discriminated unions for state machines and domain states.

## Naming

- React components, classes, enums, and exported types/interfaces: `PascalCase`.
- Functions, variables, hooks, object properties: `camelCase`.
- Constants that are truly global immutable configuration: `UPPER_SNAKE_CASE`.
- Files should be named consistently by responsibility. Avoid vague names such as `helpers.ts`, `common.ts`, or `stuff.ts`.
- Boolean names should read as predicates: `isLiving`, `hasChildren`, `canEditPerson`.

## Function design

- Keep functions single-purpose and easy to test.
- Newly written functions should keep cyclomatic complexity below 8. Refactor branching logic into named predicates or smaller functions.
- Prefer early returns over deeply nested conditionals.
- Avoid magic numbers and magic strings. Promote meaningful values to named constants or enums/unions.
- Avoid hidden mutation of input objects unless the API explicitly communicates mutability.

## Components

- Keep domain logic out of JSX.
- Prefer composition over large configurable components with many boolean props.
- Do not create custom low-level UI primitives if the established component library provides the requirement.
- Keep component props minimal and typed.
- Avoid unnecessary effects. Derive renderable state instead of synchronizing duplicate state with `useEffect`.

## Imports

Use a stable import order:

1. React / framework imports.
2. Third-party packages.
3. Internal absolute aliases.
4. Relative modules.
5. Type-only imports where applicable.
6. Styles/assets.

Avoid circular dependencies and barrel files that obscure ownership or create cycles.

## Error handling

- Do not swallow errors.
- Convert infrastructure errors into domain/application errors at boundaries.
- User-facing errors must be actionable but must not leak sensitive internals.
- Expected validation/auth failures are normal control flow and should not be reported as unexpected exceptions.

## Logging

- No committed `console.log` debugging.
- If structured logging is introduced, never log secrets, auth tokens, passwords, raw private genealogy records, or sensitive living-person data.

## Comments and documentation

Comments should explain why a non-obvious decision exists, not narrate syntax. Delete stale comments when behavior changes. Public domain-level APIs should be understandable through naming/types before comments are required.

## Duplication

Do not abstract on first sight of similar code. Abstract when duplication represents the same concept and the shared abstraction makes the domain easier to understand.

## Dead code

No unused imports, abandoned feature flags, commented-out implementations, or unreachable branches may remain in merged code.

## Formatting and linting

Repository formatting and linting configuration are authoritative. AI agents must not reformat unrelated files. Formatting-only changes should be isolated when possible.