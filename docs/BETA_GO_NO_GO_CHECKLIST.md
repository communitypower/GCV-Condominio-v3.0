# Controlled Beta Go/No-Go Checklist

Status: required before `v1.1.0-beta.1` production beta. Selected release posture: **Profile A**, with document ingestion and AI disabled for beta users.

## Release Candidate

- [ ] Release commit is selected and immutable.
- [x] `CHANGELOG.md` has an entry for the release.
- [ ] CI quality gate passed on the release commit.
- [ ] API smoke tests passed on the release commit.
- [ ] Security workflow passed or findings are documented and accepted.
- [ ] No high/critical dependency, secret, auth, tenant, document, or migration issue is open.

## Staging

- [x] Railway `staging` environment exists.
- [x] Staging app and PostgreSQL services are isolated from production.
- [x] Staging variables match the Profile A posture in `docs/RAILWAY_OPERATIONS_RUNBOOK.md`.
- [x] `NODE_ENV=staging`.
- [x] `APP_URL` matches the staging HTTPS origin.
- [ ] Google OAuth callback works on staging.
- [x] Microsoft OAuth is unavailable and excluded from beta acceptance.
- [ ] `BETA_ALLOWED_EMAILS` contains only test/beta-approved accounts.
- [x] `ENABLE_AI_ASSISTANT=false` outside controlled synthetic test windows.
- [x] `ENABLE_GITHUB_INTEGRATION=false`.
- [x] `ENABLE_DEMO_EXPORTS=false`.
- [x] `/health`, `/livez`, and `/readyz` return success.
- [ ] Smoke tests pass against staging using disposable/synthetic data.
- [ ] Tenant isolation is manually spot-checked with at least two tenants.

## Backup And Restore

- [ ] Railway PostgreSQL backups are enabled for production.
- [x] Manual pre-migration backup process is tested.
- [x] Restore drill is completed into a recovery database.
- [ ] Restored database passes `/readyz`.
- [x] Restored row counts are recorded for `User`, `Condominium`, `Membership`, and `AuditEvent`.
- [x] Restore operator, date, source backup, and validation result are recorded.
- [x] `docs/RESTORE_DRILL_LOG.md` includes the staging or production-beta restore evidence.

## Production Beta

- [x] Railway `production` environment exists.
- [x] Production database is isolated from dev/staging.
- [x] `NODE_ENV=production`.
- [x] `APP_URL` matches the production HTTPS origin.
- [ ] `SESSION_SECRET` is unique and strong.
- [ ] OAuth client secrets are production-specific.
- [ ] Google OAuth callback works on the final production domain.
- [x] Microsoft OAuth is unavailable and excluded from beta acceptance.
- [ ] `BETA_ALLOWED_EMAILS` includes only approved beta users.
- [x] Mock login is unavailable.
- [x] AI, document ingestion, GitHub/Gist, E2E hooks, and demo exports are disabled.
- [x] `/readyz` returns success after deployment.
- [ ] One authenticated core workflow is manually checked after the accepted candidate reaches production.

## Decision

- [ ] Go: all required items above are complete.
- [x] No-go: at least one required item is incomplete.

Decision owner:

Date:

Release tag:

Notes: local candidate evidence includes 19 clean migrations without drift, dependency audit with zero findings, API suites, 13/13 Chromium E2E tests, 2/2 read-only production smokes, and zero residual `TEST_E2E_` core records. This is not production approval.
