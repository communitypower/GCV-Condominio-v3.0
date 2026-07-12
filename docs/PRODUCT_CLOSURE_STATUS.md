# Product Closure Status

Date: 2026-07-11

Status: controlled beta is deployed in Railway. Technical baseline is operational; backup/restore, release governance, privacy review, and formal go/no-go remain open before broader real-data adoption.

## Latest Verified Baseline

- Source commit: `e4b426c` (`docs: define full product architecture and execution plan`).
- GitHub Actions `GCV SaaS CI`: passed on commit `e4b426c`.
- GitHub Actions `GCV SaaS Security`: Gitleaks and CodeQL passed on commit `e4b426c`.
- Railway `dev`, `staging`, and `production`: deployments completed with `SUCCESS` on 2026-07-11.
- `/health`, `/livez`, and `/readyz`: HTTP 200 in all three environments.
- Production Playwright suite: 6/6 tests passed after deployment, including governance, tenant restrictions, dashboard session flows, data lifecycle, and cleanup.
- Local validation: typecheck, production build, unit/harness tests, complete API smoke suite, and dependency audit passed; `npm audit` found zero vulnerabilities.

## Environment Reality

| Environment | App | Database | Runtime variable | Feature posture |
|---|---|---|---|---|
| `dev` | Railway isolated service/domain | isolated Railway PostgreSQL | `NODE_ENV=production` | AI/GitHub/demo exports disabled |
| `staging` | Railway isolated service/domain | isolated Railway PostgreSQL | `NODE_ENV=production` | AI/GitHub/demo exports disabled |
| `production` | Railway isolated service/domain | isolated Railway PostgreSQL | `NODE_ENV=production` | AI enabled; GitHub/demo exports disabled; E2E testing endpoint enabled |

`dev` and `staging` currently use production runtime behavior intentionally to serve the built application and enforce production-like protections. Environment identity must not be inferred only from `NODE_ENV`; a future change should add an explicit `APP_ENV` if behavior or observability needs to distinguish them.

Current Railway source integration auto-deploys `main` to all three app services. This differs from the documented promotion policy and remains an open release-governance item.

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

- [ ] Disable automatic production deployment from every `main` push; promote an immutable artifact/tag with approval.
- [ ] Add Playwright critical-path coverage to CI against an ephemeral application/database.
- [ ] Decide whether production `ENABLE_E2E_TESTING` remains enabled; restrict and monitor it if retained.
- [ ] Enable and verify Railway production backups.
- [x] Perform a Railway staging/recovery restore drill and update `docs/RESTORE_DRILL_LOG.md`.
- [x] Record RPO, RTO, restored row counts, operator, source backup, and date.
- [ ] Configure scheduled encrypted external logical backups because the current Railway plan does not expose native backups.
- [ ] Complete manual Google OAuth verification for approved beta identities after the latest deployment.
- [ ] Keep Microsoft OAuth out of release acceptance until real credentials and callbacks are configured.
- [ ] Complete LGPD/privacy review before using AI with real tenant data.
- [ ] Complete and sign `docs/BETA_GO_NO_GO_CHECKLIST.md`.
- [ ] Create a SemVer release tag only after go approval.

## Product Scope

The current beta is suitable for controlled operational validation. It is not yet a formal accounting, production BIM, regulated engineering compliance, or autonomous AI system. Post-beta expansion follows:

- `docs/TARGET_PRODUCT_ARCHITECTURE.md`
- `docs/CODEXGPT_FULL_PRODUCT_IMPLEMENTATION_PLAN.md`

Do not onboard unrestricted real tenant data until the remaining backup, restore, release, privacy, and go/no-go gates are evidenced and approved.
