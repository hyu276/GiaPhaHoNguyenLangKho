# Repository Architecture

## Target stack

Default architecture:

- Framework: Next.js with App Router.
- Language: TypeScript with strict type checking.
- UI: React.
- Database: PostgreSQL through Supabase.
- Authentication: Supabase Auth unless a later architecture decision replaces it.
- Deployment: Vercel.
- Styling/components: Tailwind CSS plus approved component libraries such as shadcn/ui. Reuse existing primitives before building custom ones.
- Validation: schema-based validation at trust boundaries, preferably Zod.

Any major deviation from this stack must be documented here before or with the implementation.

## Concrete foundation choices

The repository foundation standardizes the following implementation tooling:

- Runtime baseline: Node.js 22 or newer.
- Framework baseline: Next.js 16 App Router and React 19.
- Styling baseline: Tailwind CSS 4 with shadcn/ui-compatible primitives.
- Supabase integration: `@supabase/ssr` with separate browser and server client factories; deprecated auth-helper packages are forbidden.
- Unit test runner: Vitest.
- Browser E2E runner: Playwright.
- Static quality: ESLint, strict TypeScript, and Prettier.
- CI: GitHub Actions runs format check, lint, typecheck, unit tests, production build, and a Playwright smoke test.

These tools may be upgraded within compatible architecture boundaries. Replacing one with a competing framework or test runner requires updating this document and the relevant rule files.

## Architectural goals

The system must optimize for:

1. genealogy data integrity,
2. explicit authorization boundaries,
3. testable domain logic,
4. low coupling between UI and persistence,
5. incremental deployability,
6. understandable code for future maintainers and AI agents.

## Suggested repository structure

```text
src/
  app/                 # routes, layouts, server entry points
  components/          # reusable presentation components
    ui/                # approved low-level UI primitives
    genealogy/         # tree/profile-specific presentation
  features/            # feature-oriented modules
    people/
    relationships/
    tree/
    search/
    admin/
  domain/              # framework-independent domain rules/types
    genealogy/
  lib/                 # shared infrastructure helpers
    supabase/
    validation/
    auth/
  server/              # server-only use cases/services where needed
  types/               # cross-cutting shared types only
supabase/
  migrations/
  seed.sql              # development-only seed data if used
tests/
  integration/
  e2e/
docs/
  rules/
```

Do not create folders merely to mirror this document. Add them when the first real responsibility requires them.

## Dependency direction

Preferred dependency flow:

```text
UI / Routes
    -> Application use cases
        -> Domain rules
        -> Repository/data interfaces
            -> Supabase/PostgreSQL infrastructure
```

The domain layer must not import React, Next.js, Supabase clients, browser APIs, or route modules.

UI components must not contain direct database mutation logic. Route handlers, server actions, or server-side use cases coordinate validation, authorization, domain checks, and persistence.

## Server/client boundary

- Default to Server Components where interactivity is not required.
- Add `use client` only when browser state, effects, event handlers, or client-only libraries require it.
- Never import server-only secrets or service-role clients into Client Components.
- Keep the client bundle small. Do not move server-fetchable data into client-side fetching without a concrete reason.

## Feature boundaries

Each feature should own its use cases, validation, feature-specific UI, and tests. Shared domain concepts belong in `domain/`; generic infrastructure belongs in `lib/`.

Avoid a generic `utils.ts` dumping ground. `src/lib/utils.ts` is reserved for the shadcn class-name merge primitive only; other helpers must be named by responsibility.

## Data access

All persisted genealogy data must ultimately live in PostgreSQL. Do not maintain a competing JSON/local-storage representation as an authoritative database.

Read operations may use server components, server actions, route handlers, or a typed data-access layer depending on the use case. Writes must always pass through server-side validation and authorization.

## API conventions

Prefer direct server actions for tightly coupled first-party web mutations where appropriate. Use route handlers for externally consumable endpoints, webhooks, downloads, or boundaries that benefit from HTTP semantics.

APIs must return structured errors. Do not leak stack traces, secrets, internal SQL, or authorization details to clients.

## State management

Use URL state for shareable navigation/filter state. Use local React state for local interaction. Introduce a global state library only when multiple distant client components truly require synchronized client-owned state.

Server data should remain server-owned. Do not duplicate server truth into a global client store without a specific synchronization design.

## Architecture decision rule

Before adding a new dependency, persistence mechanism, global state system, background job system, or architectural layer, answer:

- What problem cannot be solved cleanly with the current stack?
- What new operational/security cost does this introduce?
- Can it be removed later without rewriting the domain model?

If the answer is unclear, do not add it.
