# Controlled Beta Go/No-Go Checklist

Status: required before `v0.1.0-beta.1` production beta.

## Release Candidate

- [ ] Release commit is selected and immutable.
- [ ] `CHANGELOG.md` has an entry for the release.
- [ ] CI quality gate passed on the release commit.
- [ ] API smoke tests passed on the release commit.
- [ ] Security workflow passed or findings are documented and accepted.
- [ ] No high/critical dependency, secret, auth, tenant, document, or migration issue is open.

## Staging

- [x] Railway `staging` environment exists.
- [x] Staging app and PostgreSQL services are isolated from production.
- [ ] Staging variables match `docs/RAILWAY_OPERATIONS_RUNBOOK.md`.
- [ ] `NODE_ENV=staging`.
- [ ] `APP_URL` matches the staging HTTPS origin.
- [ ] Google OAuth callback works on staging.
- [ ] Microsoft OAuth callback works on staging.
- [ ] `BETA_ALLOWED_EMAILS` contains only test/beta-approved accounts.
- [ ] `ENABLE_AI_ASSISTANT=false` unless testing with synthetic data.
- [ ] `ENABLE_GITHUB_INTEGRATION=false` unless testing with synthetic data.
- [ ] `ENABLE_DEMO_EXPORTS=false` unless explicitly testing demo behavior.
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
- [ ] Microsoft OAuth callback works on the final production domain.
- [ ] `BETA_ALLOWED_EMAILS` includes only approved beta users.
- [x] Mock login is unavailable.
- [ ] AI, GitHub/Gist, and demo export flags are disabled for real-data tenants.
- [x] `/readyz` returns success after deployment.
- [x] One authenticated core workflow is checked by the controlled production E2E suite.

## Decision

- [ ] Go: all required items above are complete.
- [ ] No-go: at least one required item is incomplete.

Decision owner:

Date:

Release tag:

Notes:
