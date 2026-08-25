# Product Closure Status

Date: 2026-08-21

Status: `v1.1.0-beta.1` candidate is locally validated. Production remains on the previous healthy image with AI/E2E disabled and automatic GitHub deployment disconnected. Formal decision remains **NO-GO** pending candidate CI/staging, OAuth-secret rotation, scheduled backup, branch protection and owner approval.

## Latest Verified Baseline

- Release branch: `release/v1.1.0-beta.1`; immutable commit is not selected yet.
- Local candidate: 19 migrations applied from zero without drift; typecheck/build/audit passed with zero dependency findings.
- Automated evidence: auth/access/CSRF, role flow, core API, ingestion/RAG, 13/13 Chromium E2E and 2/2 read-only production smoke tests passed.
- Test cleanup: zero remaining core `TEST_E2E_` accounts, documents, equipment, plans or tickets.
- Production `/health`, `/livez` and `/readyz`: HTTP 200 after containment.
- Production logical checkpoint: created outside the worktree with restricted permissions and recorded SHA-256; scheduled external backup remains open.

## Environment Reality

| Environment | App | Database | Runtime variable | Feature posture |
|---|---|---|---|---|
| `dev` | Railway isolated service/domain | isolated Railway PostgreSQL | Review pending | Previous healthy version |
| `staging` | Railway isolated service/domain + document volume | isolated Railway PostgreSQL | `NODE_ENV=staging` configured for next deploy | Profile A: document ingestion/AI/GitHub/demo/E2E disabled |
| `production` | Railway isolated service/domain | isolated Railway PostgreSQL | `NODE_ENV=production` | Profile A containment: document ingestion/AI/GitHub/demo/E2E disabled |

`dev` and `staging` currently use production runtime behavior intentionally to serve the built application and enforce production-like protections. Environment identity must not be inferred only from `NODE_ENV`; a future change should add an explicit `APP_ENV` if behavior or observability needs to distinguish them.

The GitHub source was disconnected from staging and production to stop unapproved `main` deployments. Candidate promotion is manual until repository protection and an immutable promotion workflow are approved.

## Completed

- [x] PostgreSQL/Prisma is the structured system of record for implemented business modules.
- [x] Railway app and PostgreSQL services exist for dev, staging, and production.
- [x] Environment-specific domains and application URLs are configured.
- [x] Google OAuth is configured for the Railway environment domains.
- [x] Production startup is separated from migration and seed workflows.
- [x] Prisma migrations are verified against clean PostgreSQL in CI.
- [x] Health, readiness, metrics, structured logs, security headers, rate limits, and CSRF protections exist.
- [x] Auth allowlist, secure cookies, server-side tenant guard, RBAC, and document ACL tests exist.
- [x] Core operational, data import, procurement, payment, announcement, document, and audit workflows persist in PostgreSQL.
- [x] CI quality/API smoke and security workflows pass on the current baseline.
- [x] Production E2E executes controlled `TEST_E2E_` records and cleans them up.
- [x] Target full-product architecture and post-beta CodexGPT execution plan are documented.

## Open Gates

- [x] Disable automatic production deployment from every `main` push.
- [x] Add Playwright critical-path coverage to CI against an ephemeral application/database.
- [x] Disable production `ENABLE_E2E_TESTING` and remove its secret.
- [ ] Enable and verify Railway production backups.
- [x] Perform a Railway staging/recovery restore drill and update `docs/RESTORE_DRILL_LOG.md`.
- [x] Record RPO, RTO, restored row counts, operator, source backup, and date.
- [ ] Configure scheduled encrypted external logical backups because the current Railway plan does not expose native backups.
- [ ] Complete manual Google OAuth verification for approved beta identities after the latest deployment.
- [x] Keep Microsoft OAuth out of release acceptance until real credentials and callbacks are intentionally restored.
- [ ] Complete LGPD/privacy review before using AI with real tenant data.
- [ ] Complete and sign `docs/BETA_GO_NO_GO_CHECKLIST.md`.
- [ ] Create a SemVer release tag only after go approval.

## Product Scope

The current beta is suitable for controlled operational validation. It is not yet a formal accounting, production BIM, regulated engineering compliance, or autonomous AI system. Post-beta expansion follows:

- `docs/TARGET_PRODUCT_ARCHITECTURE.md`
- `docs/CODEXGPT_FULL_PRODUCT_IMPLEMENTATION_PLAN.md`

Do not onboard unrestricted real tenant data until the remaining backup, restore, release, privacy, and go/no-go gates are evidenced and approved.
