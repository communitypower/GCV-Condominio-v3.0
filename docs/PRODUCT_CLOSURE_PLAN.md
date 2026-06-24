# Product Closure Plan

Date: 2026-06-23

Status: Approved execution plan for beta closure

Execution checkpoint:

- Week 1 foundation started: production startup separated from migrations, env validation added, Railway readiness aligned, and health endpoints added.
- Week 2 foundation started: HTTP security headers, rate limits, request ids, dependency audit script, explicit smoke/API test scripts, CI API smoke job, temporary API test cleanup, real cross-tenant negative smoke coverage, Zod validation for write routes, and security scanning workflow added.
- Operations foundation started: Railway runbook added and legacy GCP operation docs marked as historical.
- Week 3 foundation started: explicit migration verification script added, CI validates migrations on a clean database before seed/smoke tests, and Compose startup now applies versioned migrations before boot.
- Auth hardening continued: beta allowlist now gates staging/production login paths, and auth login/logout/known failed-login/OAuth-linking events are written to tenant audit logs.
- AI/export hardening started: AI, GitHub/Gist, and demo export endpoints require an authenticated session, enforce feature flags server-side, and write audit events for blocked or attempted use.
- Browser security hardening continued: staging/production block unsafe cross-origin requests with an Origin/APP_URL CSRF guard.
- Remaining Week 2 work: review security scan findings when the GitHub workflow runs and keep expanding negative coverage as new protected routes are added.
- Remaining Week 3 work: perform a real staging restore drill after Railway environments and backups are provisioned.
- Local note: Gitleaks could not be run locally because Docker failed to pull from GHCR due to host credential configuration; the GitHub Actions workflow is the intended execution path.

## 1. Executive Summary

Goal: close a controlled beta in 4-6 weeks using Railway as the official platform for `dev`, `staging`, and `production`, while keeping the current Google/Microsoft OAuth implementation and allowing limited real data only after minimum security, backup, and validation gates pass.

Current baseline:

- Local development works with Node 24, Docker Compose, PostgreSQL, Prisma, seed data, and health checks.
- Dockerfile, `railway.json`, GitHub Actions CI, PostgreSQL, and Prisma are present.
- Initial local auth, Google/Microsoft OAuth, RBAC/tenant guard, and audit logging exist.
- Test scripts exist but must be integrated into `package.json` and CI.
- Production is not ready for paid customers until env validation, automated tests, migration safety, backup/restore validation, observability, LGPD review, and AI/export hardening are complete.

Base decisions:

- Official cloud platform: Railway.
- Environments: `local`, `dev`, `staging`, `production`.
- Limited real data is allowed only in controlled beta production after the checklist passes.
- Gemini AI and GitHub/Gist demo features remain available only behind environment feature flags.

## 2. Environments And Release Flow

Create one Railway project with isolated environments:

| Environment | Purpose | Data | Deploy |
| --- | --- | --- | --- |
| `dev` | Continuous integration environment | Synthetic | Automatic from `main` |
| `staging` | Production rehearsal | Synthetic or anonymized | Manual promotion or staging tag |
| `production` | Controlled beta | Limited real data | Semver tag with manual approval |

Each environment must have its own app service, PostgreSQL service, variables, secrets, and domain/callback URLs.

Required runtime variables:

- `NODE_ENV`
- `APP_URL`
- `DATABASE_URL`
- `SESSION_SECRET`
- `BETA_ALLOWED_EMAILS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `ENABLE_AI_ASSISTANT`
- `ENABLE_GITHUB_INTEGRATION`
- `ENABLE_DEMO_EXPORTS`

Release rules:

- Pull requests run CI only.
- Merges to `main` deploy to `dev`.
- `staging` receives promoted builds or staging tags.
- `production` receives only `v*` semver tags after manual checklist approval.
- Production deploys must not be run from a developer machine.

## 3. Implementation Workstreams

### Runtime, Railway, And Health

- Separate app startup from database migrations.
- Use `prisma migrate deploy` for deployed environments.
- Keep `prisma db push` only for local development.
- Add startup environment validation.
- Keep `/health` for shallow status.
- Add `/livez` for process liveness.
- Add `/readyz` for dependency readiness and Railway deploy healthcheck.

### Auth, Sessions, And Tenant Safety

- Keep Google/Microsoft OAuth for beta.
- Block mock login outside local/dev.
- Use secure, signed, `HttpOnly` cookies in production-like environments.
- Require `BETA_ALLOWED_EMAILS` in staging/production and block login/OAuth for users outside the allowlist.
- Audit login, logout, known failed login attempts, and OAuth account linking.
- Expand tenant isolation tests to cover account, condominium, unit, billing, documents, and audit routes.

### Database And Migrations

- Treat PostgreSQL as the system of record.
- Commit all Prisma migrations.
- Validate migrations in CI against a fresh PostgreSQL database.
- Run backup before production migrations.
- Prefer forward fixes over destructive rollback.
- Keep seed data synthetic.

### AI, GitHub, And Demo Controls

- Gate Gemini with `ENABLE_AI_ASSISTANT` on authenticated backend routes.
- Gate GitHub/Gist with `ENABLE_GITHUB_INTEGRATION` on authenticated backend routes.
- Gate demo exports with `ENABLE_DEMO_EXPORTS` on authenticated backend routes.
- Disable AI/export for tenants containing real data until LGPD review is complete.
- Audit every AI/export attempt.

### Security And Operations

- Add request size limits, security headers, and rate limits.
- Add CSRF/origin protection for cookie-authenticated unsafe requests in production-like environments.
- Remove framework fingerprinting headers.
- Add structured logs with request id, environment, route, status, latency, user id, and tenant id when available.
- Sanitize PII/secrets from logs.
- Add `npm audit --audit-level=high`, secret scanning, and SAST to CI.
- Create runbooks for deploy, rollback, restore, failed migration, secret rotation, and tenant data exposure.

## 4. 4-6 Week Execution Plan

### Week 1: Operational Foundation

- Correct production startup and migration scripts.
- Add env validation and health/readiness endpoints.
- Align Railway config with `/readyz`.
- Document Railway variables for `dev`, `staging`, and `production`.
- Run typecheck and build.

### Week 2: Tests And Minimum Security

- Convert existing TypeScript test scripts into `npm test`.
- Add API tests for auth, tenant isolation, document ACLs, and OAuth.
- Add rate limits and security headers.
- Ensure mock login is unavailable in `staging` and `production`.

Current test runner note:

- `npm test` runs the OAuth test harness.
- `npm run test:api` runs the existing API smoke scripts against `BASE_URL`, defaulting to `http://localhost:3000/api/v1`.
- CI starts a seeded test server on `http://localhost:3200` and runs OAuth plus API smoke tests against a fresh PostgreSQL service.
- `NODE_ENV=test` serves the built `dist` bundle instead of Vite middleware to keep API smoke runs stable.
- API smoke scripts create temporary records and clean them up, but CI still runs them against fresh/disposable data.
- Feature flag smoke tests assert disabled AI, GitHub, and demo export endpoints return 403 for authenticated users and record audit events.

### Week 3: Persistence And Migration Safety

- Validate Prisma migrations against a clean PostgreSQL database in CI.
- Remove `db push` from all deployed paths.
- Create migration and backup runbooks.
- Perform a staging restore drill.

Current migration safety note:

- `npm run db:migrate:verify` runs `prisma migrate deploy`, `prisma migrate status`, and a Prisma diff from the database URL to `prisma/schema.prisma`.
- The verification target must be a clean/disposable database or an environment already managed by Prisma Migrate, not an older local database created only with `db push`.
- CI runs that verification against a clean PostgreSQL service before seed and API smoke tests.
- Docker Compose applies versioned migrations before local container startup.
- Railway uses `npm run db:migrate:deploy` as the pre-deploy command.

### Week 4: Staging Beta

- Deploy `dev` and `staging` Railway environments with separate databases.
- Validate OAuth callbacks in staging.
- Run smoke tests after deployment.
- Validate tenant isolation with synthetic data.
- Freeze beta-blocking issues.

### Week 5: Controlled Production Beta

- Create production Railway environment with isolated database and daily backups.
- Configure production domain and OAuth callback URLs.
- Deploy `v0.1.0-beta.1`.
- Enable only allowlisted beta users.
- Keep AI/export disabled for real-data tenants.

### Week 6: Stabilization

- Fix beta bugs.
- Run rollback and restore drills.
- Publish `CHANGELOG.md`.
- Produce go/no-go checklist for expanding beta access.

## 5. Acceptance Criteria

Before staging:

- `npm ci`
- `npm run lint`
- `npm run build`
- `npm test`
- `npm audit --audit-level=high`
- Migration test passes on a clean PostgreSQL database.
- Secret scan has no high/critical findings.

Before production beta:

- `production` Railway environment has separate database and variables.
- Daily backups are enabled.
- Restore drill has passed.
- OAuth callbacks work on the final production domain.
- Mock login is blocked.
- Tenant isolation tests pass.
- No high/critical finding remains open in auth, tenant, documents, secrets, or migrations.
- Runbooks exist for deploy, rollback, restore, secret rotation, and failed migration.

## 6. Explicit Non-Goals For This Beta

- No real boleto, PIX, CNAB, bank reconciliation, or formal accounting ledger.
- No production-wide paid customer launch.
- No unrestricted AI processing of real tenant data.
- No GitHub/Gist export for real tenant data.
- No migration to a managed auth provider during this closure cycle.
