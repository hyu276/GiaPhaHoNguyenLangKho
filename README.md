# GiaPhaHoNguyenLangKho

Web application for preserving, validating, and exploring the genealogy of họ Nguyễn Làng Khô.

## Engineering contract

Before changing code, read [`AGENTS.md`](./AGENTS.md) and [`docs/rules/README.md`](./docs/rules/README.md). The files under `docs/rules/` are normative repository requirements for both human contributors and AI coding agents.

## Foundation stack

- Next.js 16 App Router
- React 19 + strict TypeScript
- Tailwind CSS 4
- shadcn/ui-compatible component primitives
- Supabase PostgreSQL/Auth with separated browser/server clients
- Zod validation at trust/configuration boundaries
- ESLint + Prettier
- Vitest for unit tests
- Playwright for browser E2E tests
- GitHub Actions quality gate
- Vercel as the target deployment platform

Node.js 22 or newer is required.

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`package-lock.json` is committed and is the reproducible dependency source for local setup, CI, and deployment. Use `npm install` only when intentionally changing dependencies and commit the resulting lockfile change with `package.json`.

Populate `.env.local` with the publishable Supabase configuration from your Supabase project:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never place a Supabase service-role key in a `NEXT_PUBLIC_*` variable.

## Canonical commands

```bash
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run quality
```

`npm run quality` is the local completion gate for formatting, linting, type checking, unit tests, and production build. CI additionally runs the Playwright smoke test.

## Current repository structure

```text
src/
  app/                    # App Router routes and global presentation
  components/
    ui/                   # shadcn-compatible low-level primitives
  lib/
    supabase/             # separated browser/server Supabase factories
    validation/           # trust-boundary/configuration validation

tests/
  unit/                   # Vitest
  e2e/                    # Playwright
supabase/
  migrations/             # versioned database changes

docs/
  rules/                  # normative engineering rules
```

Feature/domain directories are intentionally created only when real responsibilities exist. This follows the architecture rule against speculative folder scaffolding.

## Supabase boundary

Use `createSupabaseBrowserClient()` only in browser/client code. Use `createSupabaseServerClient()` in Server Components, Server Actions, and Route Handlers. The server factory is marked `server-only`, and neither factory contains service-role credentials.

Authentication token refresh proxy behavior should be added when the first authenticated route is implemented, following the current `@supabase/ssr` Proxy pattern rather than deprecated auth-helper packages.
