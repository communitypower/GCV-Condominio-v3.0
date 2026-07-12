# Session Checkpoint

Last updated: 2026-07-11

## Current State

GCV is deployed as a controlled Railway beta with React/Vite, Express, PostgreSQL, Prisma, server-side sessions, OAuth, tenant-scoped authorization, audit events, API smoke tests, Playwright E2E, and CI/security workflows.

Current source commit after Gate G0.1: `e4b426c`.

Railway dev, staging, and production deployments are healthy. All three currently auto-deploy from `main` and use `NODE_ENV=production`; this must be replaced by immutable promotion for production and may later be complemented by an explicit `APP_ENV`.

## Sources of Truth

Current beta and operations:

- `docs/PRODUCT_CLOSURE_PLAN.md`
- `docs/PRODUCT_CLOSURE_STATUS.md`
- `docs/RAILWAY_OPERATIONS_RUNBOOK.md`
- `docs/BETA_GO_NO_GO_CHECKLIST.md`

Full-product evolution:

- `docs/TARGET_PRODUCT_ARCHITECTURE.md`
- `docs/CODEXGPT_FULL_PRODUCT_IMPLEMENTATION_PLAN.md`
- `docs/CODEX_IMPLEMENTATION_PLAYBOOK.md`

Historical plans and reviews remain useful as decision history but do not describe the current implementation baseline.

## Active Product Boundaries

- PostgreSQL is the structured system of record for implemented operational modules.
- `localStorage` is limited to interface/session hints and must not own business records or provider credentials.
- Current finance is operational tracking, not formal accounting, bank reconciliation, real boleto/Pix, or fiscal bookkeeping.
- Current BIM and LCC views are prototypes; production implementations follow Gates 6 and 7 of the full-product plan.
- AI is feature-flagged and must not process unrestricted real tenant data before policy, redaction, evaluation, and LGPD approval.
- GitHub/Gist integration remains disabled for production data.

## Latest Validation

- Local typecheck, build, harness tests, API smoke tests, and dependency audit passed.
- GitHub CI, migration verification, API smoke, Gitleaks, and CodeQL passed on `e4b426c`.
- Railway dev/staging/production healthchecks passed.
- Production Playwright suite passed 6/6 and completed cleanup.

## Next Codex Work

Continue Gate 0 in `docs/CODEXGPT_FULL_PRODUCT_IMPLEMENTATION_PLAN.md`:

1. G0.2: keep active documentation aligned with verified infrastructure.
2. G0.3: add critical Playwright workflows to CI against an ephemeral app/database.
3. G0.4: prepare restore evidence and request only the Railway dashboard actions that cannot be automated safely.

Do not begin accounting, production BIM, LCC, or unrestricted AI before their dependency gates.
