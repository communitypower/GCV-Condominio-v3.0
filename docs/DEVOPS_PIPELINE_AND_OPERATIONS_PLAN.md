# DevOps Pipeline And Operations Plan

Date: 2026-05-31

Status: Draft for implementation

Scope: how GCV Condominio should move from local Codex development to cloud SaaS delivery, and how future users receive updates, bug fixes, security fixes, and operational support.

Primary execution reference:

- `docs/GCV_SAAS_IMPLEMENTATION_MASTER_PLAN.md`
- `docs/CODEX_IMPLEMENTATION_PLAYBOOK.md`
- `docs/LEAN_COST_CLOUD_PLAN.md`

## 1. Executive Recommendation

Use a trunk-based workflow with local Codex development, GitHub pull requests, GitHub Actions CI/CD, immutable Docker images, and staged promotion to GCP Cloud Run after local and gate checks pass.

Recommended default stack:

- Source control: GitHub
- Local development: Codex + npm + Docker Compose
- CI/CD: GitHub Actions
- Runtime: Node.js 24 LTS
- Package manager: npm with committed `package-lock.json`
- Container registry: Google Artifact Registry when cloud deploy begins
- App hosting: local Docker first, then Google Cloud Run
- Database: local PostgreSQL first, then Cloud SQL PostgreSQL when gates require it
- File storage: local/synthetic storage first, then Google Cloud Storage when document ACL/upload flow is ready
- Secrets: ignored local env files first, then Google Secret Manager for cloud environments
- Deploy auth: GitHub OIDC to Google Workload Identity Federation
- Observability: Cloud Logging, Cloud Monitoring, Error Reporting, OpenTelemetry later
- Dependency updates: Renovate as primary, Dependabot security alerts enabled

Core principle:

- Build once, scan once, promote the same image digest through `dev`, `staging`, and `production`.

## 2. Current Repository Gaps

Current state:

- No `.github/` workflows.
- No Dockerfile.
- No `.nvmrc` or Node engine pin.
- No deployment descriptor or IaC.
- No tests beyond TypeScript checking.
- `npm run lint` currently means `tsc --noEmit`.
- `package-lock.json` exists locally but is untracked.
- `server.ts` hardcodes `PORT = 3000`.
- No `/healthz`, `/livez`, or `/readyz`.
- No structured logging, request IDs, graceful shutdown, env validation, or rate limits.
- Production-risky GitHub OAuth/Gist and Gemini flows remain in code.

Conclusion:

- It is safe to start DevOps foundation work now.
- It is not safe to deploy real tenant data until auth, tenancy, persistence, RBAC, AI/export controls, and LGPD gates are implemented.

## 3. Local Codex Development Workflow

Recommended developer flow:

```text
main
  feature/<short-topic>
  fix/<short-topic>
  chore/<short-topic>
  hotfix/<prod-issue>
```

Local workflow:

1. Sync latest `main`.
2. Create a short-lived branch.
3. Use Codex locally to implement small PR-sized changes.
4. Run local checks before pushing:

```bash
npm ci
npm run lint
npm run build
```

5. Push branch and open PR.
6. CI must pass before merge.
7. Merge by squash or rebase merge to keep history readable.

Rules:

- Codex can write code locally, but production deploys must happen only through CI/CD.
- No direct deploys from a developer machine.
- No commits directly to protected `main`.
- No secrets in local files beyond ignored `.env` files.
- `localStorage` data is disposable during prototype migration.

Future local stack:

- `docker-compose.yml` with app, PostgreSQL, Redis, mail catcher, object-storage emulator, and seeded synthetic tenant.

## 4. Branching And Pull Request Policy

Use trunk-based development:

- `main` is always releasable.
- Feature branches live for days, not weeks.
- Release branches only if a beta/production launch needs stabilization.
- Hotfix branches are created from the latest production tag.

Protected branch rules for `main`:

- Require pull request.
- Require at least one reviewer.
- Require status checks.
- Require linear history or squash merge.
- Block force pushes.
- Block deletion.
- Require conversation resolution.
- Require signed commits later if enterprise customers require it.

Required PR checks:

- Install
- Typecheck
- Build
- Unit tests once available
- API tests once available
- Playwright smoke once available
- Audit
- Secret scan
- SAST
- Docker build once Dockerfile exists

Sensitive-path rule:

- Changes touching auth, tenant scoping, billing, documents, AI, GitHub/export, migrations, or security config require senior review and tests.

## 5. CI Pipeline

Create `.github/workflows/ci.yml`.

Initial jobs:

1. `install-and-cache`
2. `typecheck`
3. `build`
4. `audit`
5. `secret-scan`
6. `codeql-or-semgrep`

Later jobs:

1. `unit-tests`
2. `api-tests`
3. `playwright-smoke`
4. `migration-check`
5. `tenant-rbac-negative-tests`
6. `pii-fixture-scan`

Minimum commands:

```bash
npm ci
npm run lint
npm run build
npm audit --audit-level=high
```

Security defaults:

- Use `permissions: read-all` by default.
- Grant `id-token: write` only to deploy jobs.
- Grant registry write only to container publish jobs.
- Do not use `pull_request_target` for untrusted PR code.
- Do not expose secrets to fork PRs.

## 6. Container And Artifact Strategy

Create:

- `Dockerfile`
- `.dockerignore`
- `.github/workflows/container.yml`

Container build principles:

- Use Node.js 24 LTS base image.
- Run `npm ci`.
- Run `npm run build`.
- Copy only runtime artifacts and production dependencies into final image.
- Run as non-root user.
- Expose app port.
- Start with `node dist/server.cjs`.
- Add health check after `/healthz` exists.

Image tags:

- Git SHA: `gcv-condominio:<sha>`
- Branch aliases for dev only: `main`
- Release tags: `v0.1.0`, `v0.1.1`

Artifact policy:

- Build the container once from the commit SHA.
- Scan the image.
- Generate SBOM/provenance when tooling is ready.
- Promote the same digest across environments.
- Roll back by known-good digest or Cloud Run revision.

## 7. Deployment Environments

Required environments:

| Environment | Purpose | Deployment | Data |
| --- | --- | --- | --- |
| local | Codex/dev loop | Developer machine | Synthetic/disposable |
| dev | Shared integration | Auto from `main` | Synthetic |
| staging | Production rehearsal | Manual or automatic after dev | Synthetic/anonymized |
| production | Customer SaaS | Manual approved release | Real customer data |

Recommended GCP layout:

- Create cloud resources progressively according to the master plan gates.
- Separate GCP projects for `dev`, `staging`, and `prod`, or at minimum separate services, databases, buckets, service accounts, and secrets once those environments exist.
- Separate Cloud SQL instances for production and non-production only after Cloud SQL is approved by gate.
- Separate buckets per environment only after document storage is approved by gate.
- Separate Secret Manager secrets per cloud environment.

## 8. Deployment Flow

Recommended flow:

```text
Pull Request
  -> CI gates
  -> merge to main
  -> build container image by SHA
  -> deploy to dev
  -> run dev smoke checks
  -> promote same image digest to staging
  -> run migrations and staging smoke/e2e
  -> create release tag vX.Y.Z
  -> manual production approval
  -> deploy same image digest to production
  -> health checks and smoke checks
  -> publish release notes
```

Workflow files:

- `.github/workflows/ci.yml`
- `.github/workflows/container.yml`
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-prod.yml`
- `.github/workflows/rollback.yml`

Production deployment:

- Only from `v*` tags or GitHub Releases.
- Requires GitHub Environment approval.
- No self-approval.
- Uses OIDC to GCP, not service account JSON keys.
- Deploys the already-built image digest.
- Performs canary or no-traffic deployment first.
- Shifts traffic only after `/healthz` and smoke tests pass.

## 9. Cloud Authentication And Secrets

Use:

- GitHub OIDC
- Google Workload Identity Federation
- Environment-scoped service accounts
- Google Secret Manager

Do not use:

- Long-lived GCP JSON keys in GitHub.
- Production secrets in `.env`.
- Provider tokens in `localStorage`.
- Secrets printed in logs.

Required runtime secrets later:

- Database URL
- Session secret
- Auth provider secret/config
- Gemini API key if AI remains enabled
- Email provider API key
- Object storage credentials if not using workload identity
- GitHub OAuth credentials only if integration remains enabled

GitHub Actions secret policy:

- Store only non-sensitive identifiers in GitHub repo variables when possible.
- Store production secrets in Google Secret Manager.
- Use GitHub Environments for deployment approval and scoped variables.

## 10. Health Checks And Server Readiness

Add endpoints:

- `/livez`: process is alive; no dependency checks.
- `/readyz`: DB reachable, migrations current, required env loaded, storage reachable.
- `/healthz`: shallow public status for uptime monitoring.

Server changes required:

- Replace hardcoded `PORT = 3000` with `process.env.PORT || 3000`.
- Add startup env validation.
- Add graceful shutdown for `SIGTERM`.
- Add request timeout.
- Add body-size limits.
- Add structured request logging.
- Add request IDs.

Cloud Run checks:

- Configure startup/liveness probes after endpoints exist.
- Keep readiness checks internal or protected if they reveal dependency details.

## 11. Database Migrations

Recommended stack:

- PostgreSQL
- Prisma Migrate for MVP

Migration rules:

- Every schema change requires a migration.
- CI runs migrations against a fresh test database.
- Staging runs migrations before production.
- Production migrations require backup/PITR verification.
- Use expand/contract migrations:
  - Add new nullable column/table.
  - Deploy app writing both or reading fallback.
  - Backfill.
  - Switch reads.
  - Remove old field in later release.

Avoid:

- Dropping columns in the same release that stops using them.
- Renaming columns without compatibility layer.
- Mutating financial/legal state implicitly during UI load.

Rollback strategy:

- App rollback is Cloud Run revision/image rollback.
- Database rollback is usually restore or forward fix, not destructive down migration.
- Production migration runbooks must include impact, backup point, validation, and rollback/forward-fix plan.

## 12. Observability And Operations

Logging:

- Structured JSON logs.
- Include `request_id`, `tenant_id`, `user_id`, route, status, latency, version, environment.
- Scrub PII/secrets.

Metrics:

- Request rate, latency, error rate.
- DB connections, query latency, storage, CPU.
- Queue depth/age when queues exist.
- Auth failures.
- AI calls/tokens/errors.
- Export attempts.
- Document upload/download failures.

Alerts:

- 5xx spike.
- p95 latency threshold.
- Cloud Run restart loop.
- DB CPU/storage/connections.
- Failed backups.
- Migration failure.
- Auth anomaly.
- Tenant isolation test failure.
- AI/provider error spike.

Runbooks:

- Rollback app.
- Disable AI.
- Disable GitHub/export.
- Rotate secrets.
- Revoke sessions.
- Restore database.
- Respond to tenant data exposure.
- Handle failed migration.

## 13. Backups And Restore

PostgreSQL:

- Automated encrypted backups.
- Point-in-time recovery.
- Minimum 30 days retention for MVP.
- Weekly restore drill before beta.
- Monthly restore drill after beta.

Documents:

- GCS object versioning.
- Lifecycle policy.
- Retention policy based on legal review.

Targets:

- MVP RPO: 15 minutes if PITR is enabled; otherwise 24 hours until PITR.
- MVP RTO: 4 hours.

## 14. Dependency And Runtime Update Policy

Use:

- npm
- committed `package-lock.json`
- Renovate for version updates
- Dependabot security alerts enabled

Update cadence:

- Weekly patch/minor dependency PRs.
- Monthly major dependency review.
- Emergency PR immediately for exploitable CVEs.
- Quarterly runtime review.
- Complete Node runtime upgrades before EOL windows.

Security patch SLA:

| Severity | SLA |
| --- | --- |
| Critical/exploited | Same day or within 24 hours |
| High | 3-7 days |
| Medium | 30 days |
| Low | 90 days |

Runtime:

- Standardize on Node.js 24 LTS.
- Test all CI/deploy images against that runtime.
- Keep `.nvmrc`, `package.json engines`, Docker image, and Cloud Run runtime aligned.

## 15. Versioning, Releases, And Changelog

Pre-production:

- Start at `0.1.0`.
- Use frequent `0.x.y` releases.

Production:

- Use semantic versioning:
  - `PATCH`: bug/security fixes.
  - `MINOR`: backward-compatible features.
  - `MAJOR`: breaking API/data changes.

Maintain:

- `CHANGELOG.md`
- GitHub Releases
- Release notes for customers
- Migration notes
- Known issues
- Rollback instructions

Release note sections:

- Added
- Changed
- Fixed
- Security
- Deprecated
- Removed
- Migration Notes

## 16. Bug Fixes For Future SaaS Users

Because this is SaaS, users should receive fixes through centralized deployments, not manual installs.

Bug-fix flow:

1. Triage support ticket or monitoring alert.
2. Assign severity.
3. Reproduce in local or staging.
4. Create `fix/<issue>` branch from `main`.
5. Add regression test.
6. Run CI.
7. Merge to `main`.
8. Deploy to dev/staging.
9. Promote to production in next scheduled release or hotfix.
10. Update release notes and support ticket.

Hotfix flow:

1. Create `hotfix/<issue>` from latest production tag.
2. Fix only the incident.
3. Add targeted regression test.
4. Run full CI.
5. Deploy to staging.
6. Manual production approval.
7. Tag patch version.
8. Deploy production.
9. Merge/cherry-pick back to `main`.
10. Publish incident note if customer-visible.

Bug severity:

| Severity | Examples | Target |
| --- | --- | --- |
| P0 | Data leak, auth bypass, data loss, production down | Immediate response |
| P1 | Core workflow broken, billing/maintenance inaccessible | Same day |
| P2 | Important feature degraded | Next patch release |
| P3 | Minor UI/UX issue | Backlog |

## 17. Feature Flags

Start with environment/config flags:

- `FEATURE_AI_ASSISTANT`
- `FEATURE_GITHUB_EXPORT`
- `FEATURE_REAL_BILLING`
- `FEATURE_DOCUMENT_UPLOAD`
- `FEATURE_RESIDENT_PORTAL`

Later add managed feature flags with:

- Tenant targeting.
- User-role targeting.
- Gradual rollout.
- Kill switch.
- Audit of flag changes.

High-risk features must have kill switches:

- AI assistant.
- Exports.
- Billing mutations.
- New auth flows.
- Document upload.
- Notifications.

## 18. Security Pipeline Controls

Required CI controls:

- `npm audit`
- CodeQL or Semgrep
- Gitleaks or TruffleHog
- Dependency review
- Container scanning with Trivy or Grype
- IaC scanning once Terraform/config exists
- PII fixture scanning
- RBAC/tenant isolation tests

Secret handling:

- Mask generated tokens.
- Do not echo env vars.
- Disable shell tracing in secret jobs.
- Do not upload `.env`, traces, videos, screenshots, or coverage dumps containing PII/secrets.
- Expire artifacts quickly.

Launch gate:

- No high/critical findings.
- No real PII in fixtures.
- OIDC deploy auth in place.
- Production approval configured.
- RBAC/tenant tests pass.
- Audit events exist for sensitive actions.
- OAuth tokens are not browser-held.
- LGPD incident workflow exercised.

## 19. Incident Response And LGPD Readiness

Before beta:

- Assign incident commander.
- Assign privacy owner/encarregado or responsible contact.
- Create incident runbooks.
- Create customer communication templates.
- Create ANPD communication workflow.
- Run tabletop exercise.

Incident categories:

- P0: cross-tenant data exposure, auth bypass, data loss, provider token leak.
- P1: production outage, migration failure, broken core workflow.
- P2: degraded performance, non-core feature outage.
- P3: minor defect.

LGPD note:

- Potentially harmful personal data incidents may require communication to ANPD and affected data subjects. Legal/privacy owner must define the exact process and timing.

## 20. First Implementation PR Sequence

PR 1: Runtime foundation.

- Add `.nvmrc`.
- Add `engines` and `packageManager` to `package.json`.
- Commit `package-lock.json`.
- Update app version to `0.1.0`.
- Add `CHANGELOG.md`.

PR 2: Baseline CI.

- Add `.github/workflows/ci.yml`.
- Run `npm ci`, `npm run lint`, `npm run build`, `npm audit`.
- Add CodeQL or Semgrep.
- Add secret scan.

PR 3: Server cloud readiness.

- Use `process.env.PORT || 3000`.
- Add `/livez`, `/readyz`, `/healthz`.
- Add env validation.
- Add structured request logging.
- Add graceful shutdown.

PR 4: Container foundation.

- Add `Dockerfile`.
- Add `.dockerignore`.
- Add container build workflow.
- Add image scan.

PR 5: Local data foundation.

- Add local Docker Compose with PostgreSQL.
- Add ignored local env template.
- Document local database startup and teardown.
- Keep all data synthetic/disposable.

PR 6: Deploy dev.

- Configure GCP Artifact Registry.
- Configure Workload Identity Federation.
- Add Cloud Run dev deployment workflow.
- Deploy from `main` to dev.
- Keep Cloud Run min instances 0 and cap dev max instances low.

PR 7: Test foundation.

- Add Vitest.
- Add first unit tests for billing and maintenance status helpers.
- Add Supertest for health endpoints.

PR 8: Staging/prod promotion.

- Add GitHub Environments.
- Add deploy staging workflow.
- Add deploy production workflow.
- Add rollback workflow.
- Activate staging/prod only after the SaaS gates in the master plan approve them.

PR 9: Maintenance automation.

- Add Renovate config.
- Enable Dependabot alerts/security updates.
- Add release note template.
- Add hotfix runbook.

PR 10: Security launch gates.

- Add PII fixture scanner.
- Add RBAC/tenant isolation test framework placeholder.
- Disable GitHub/Gist and real AI in production by default.

## 21. References

- Node.js releases: https://nodejs.org/en/about/previous-releases
- GitHub Actions environments: https://docs.github.com/en/actions/reference/deployments-and-environments
- GitHub OIDC: https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-cloud-providers
- Google Workload Identity Federation: https://cloud.google.com/iam/docs/workload-identity-federation
- Cloud Run health checks: https://docs.cloud.google.com/run/docs/configuring/healthchecks
- Cloud Run rollouts/rollbacks/traffic migration: https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration
- GitHub Dependabot: https://docs.github.com/en/code-security/dependabot
- GitHub secret scanning: https://docs.github.com/en/code-security/secret-scanning
