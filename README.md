# GiaPhaHoNguyenLangKho

Web application for creating, maintaining, and browsing the genealogy of the Nguyen family of Lang Kho.

## Planned technical foundation

- Next.js + TypeScript
- Supabase / PostgreSQL
- Supabase Auth
- Vercel deployment
- Tailwind CSS + approved reusable UI components

## Engineering rules

This repository is intentionally rule-driven so human contributors and AI coding agents follow the same architecture, data-integrity, security, and quality constraints.

Start here:

- [`AGENTS.md`](./AGENTS.md) — mandatory AI engineering constitution.
- [`docs/rules/README.md`](./docs/rules/README.md) — rule index and task-specific reading matrix.
- [`docs/rules/02-ARCHITECTURE.md`](./docs/rules/02-ARCHITECTURE.md) — target repository/system architecture.
- [`docs/rules/03-CODE-QUALITY.md`](./docs/rules/03-CODE-QUALITY.md) — code quality standards.
- [`docs/rules/04-GENEALOGY-DOMAIN.md`](./docs/rules/04-GENEALOGY-DOMAIN.md) — genealogy graph invariants.
- [`docs/rules/05-SECURITY-PRIVACY.md`](./docs/rules/05-SECURITY-PRIVACY.md) — authorization, secrets, and personal-data rules.

GitHub Copilot-specific enforcement lives in `.github/copilot-instructions.md` and redirects Copilot back to the same authoritative rules.

## Status

The repository currently contains the engineering foundation and rule set. Application scaffolding should be created only after reading the mandatory documents above.