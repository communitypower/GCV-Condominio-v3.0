# Railway Operations Runbook

Date: 2026-06-23

Status: Operational runbook for controlled beta closure

## 1. Environment Model

Use one Railway project with isolated environments:

| Environment | Purpose | Data policy | Deploy trigger |
| --- | --- | --- | --- |
| `dev` | Shared integration | Synthetic only | Railway auto-deploy from `main` |
| `staging` | Production rehearsal | Synthetic or anonymized | Manual promotion or staging tag |
| `production` | Controlled beta | Limited real data | Semver release tag and manual approval |

Each environment must have its own:

- App service
- PostgreSQL service
- Variables/secrets
- Domain
- OAuth callback URLs
- Backup/restore procedure

Do not share a `DATABASE_URL`, `SESSION_SECRET`, OAuth secret, or production domain between environments.

## 2. Step 1: Provision Railway Environments

Goal: create the isolated Railway foundation required before staging validation. Do not add real tenant data during this step.

Prerequisites:

- GitHub repository access to `communitypower/GCV-Condominio-v3.0`.
- Railway workspace access with permission to create projects, environments, services, variables, and PostgreSQL plugins.
- A release operator responsible for recording environment URLs and validation results.
- The latest `main` branch must be green in GitHub Actions.

### 2.1 Create The Railway Project

1. In Railway, create a new project named `gcv-condominio`.
2. Connect the project to the GitHub repository `communitypower/GCV-Condominio-v3.0`.
3. Select Dockerfile-based builds.
4. Confirm Railway detects `railway.json`.
5. Confirm these project-level deployment settings are visible or inherited from `railway.json`:
   - Build: Dockerfile
   - Pre-deploy command: `npm run db:migrate:deploy`
   - Start command: `npm run start`
   - Healthcheck path: `/readyz`

### 2.2 Create Isolated Environments

Create these Railway environments in the same project:

| Environment | Purpose | Data allowed now | Deploy mode |
| --- | --- | --- | --- |
| `dev` | Shared integration | Synthetic only | Auto-deploy from `main` is allowed |
| `staging` | Production rehearsal | Synthetic or anonymized only | Manual promotion or staging tag |
| `production` | Controlled beta | No real data until go/no-go passes | Manual release/tag promotion only |

Rules:

- Do not clone variables from production into non-production or from non-production into production without reviewing each value.
- Do not share PostgreSQL services between environments.
- Do not enable production real-data use until the beta checklist is complete.

### 2.3 Create Services Per Environment

For each environment, create:

1. One app service connected to the GitHub repo.
2. One Railway PostgreSQL service.
3. One generated Railway domain for initial validation.
4. Later, one custom domain when DNS is ready.

Service names:

- `gcv-app-dev`
- `gcv-postgres-dev`
- `gcv-app-staging`
- `gcv-postgres-staging`
- `gcv-app-production`
- `gcv-postgres-production`

### 2.4 Configure Deployment Behavior

Set the app service behavior:

- `dev`: auto-deploy from `main` may be enabled after variables are configured.
- `staging`: keep auto-deploy disabled unless a staging tag flow is explicitly configured.
- `production`: keep auto-deploy disabled; deploy only after `docs/BETA_GO_NO_GO_CHECKLIST.md` is complete.

Before first deploy in each environment:

- Add all required variables from the next section.
- Confirm `DATABASE_URL` points to that environment's Railway PostgreSQL service.
- Confirm `APP_URL` matches the Railway HTTPS domain exactly.
- Keep AI, GitHub, and demo export flags disabled.

### 2.5 Validate Provisioning

After variables are configured and the app deploys:

1. Open the Railway deployment logs and confirm migrations ran through `npm run db:migrate:deploy`.
2. Confirm the app starts with `npm run start`.
3. Validate:

```bash
curl -fsS https://<environment-domain>/health
curl -fsS https://<environment-domain>/livez
curl -fsS https://<environment-domain>/readyz
```

4. Record each environment domain, app service, database service, and validation result in the release notes or beta checklist.

Step 1 is complete only when `dev` and `staging` have isolated app/database services, required variables, successful deploys, and passing health/readiness checks. `production` may be provisioned at this stage, but it must not receive real data until backup, restore, OAuth, staging smoke, LGPD/privacy, and go/no-go gates pass.

## 3. Required Variables

Set these in every Railway environment:

```env
NODE_ENV=production
APP_URL=https://<environment-domain>
DATABASE_URL=<railway-postgres-url>
SESSION_SECRET=<strong-random-secret>
BETA_ALLOWED_EMAILS=<comma-separated-beta-user-emails>

GOOGLE_CLIENT_ID=<provider-client-id>
GOOGLE_CLIENT_SECRET=<provider-client-secret>
MICROSOFT_CLIENT_ID=<provider-client-id>
MICROSOFT_CLIENT_SECRET=<provider-client-secret>
MICROSOFT_TENANT_ID=common

ENABLE_AI_ASSISTANT=false
ENABLE_GITHUB_INTEGRATION=false
ENABLE_DEMO_EXPORTS=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
```

Environment-specific values:

- `dev`: `NODE_ENV=development` is acceptable only if the Railway environment is intentionally running Vite middleware; otherwise use `production`.
- `staging`: use `NODE_ENV=staging`.
- `production`: use `NODE_ENV=production`.
- `BETA_ALLOWED_EMAILS`: required in `staging` and `production`; only these e-mails can complete password login or OAuth.
- `APP_URL`: must exactly match the public HTTPS app origin because production-like CSRF protection allows unsafe browser requests only from this origin or the current request host.

Feature flags:

- Keep `ENABLE_AI_ASSISTANT=false` for real-data tenants until LGPD/privacy review.
- Keep `ENABLE_GITHUB_INTEGRATION=false` for production unless explicitly approved.
- Keep `ENABLE_DEMO_EXPORTS=false` for real-data tenants.
- These flags are enforced server-side on authenticated endpoints and blocked attempts are written to tenant audit logs.

## 4. Deployment Flow

Before deployment:

```bash
npm ci
npm run check
npm test
npm run db:migrate:verify
```

Run `db:migrate:verify` only against a clean/disposable database or an environment that already has Prisma Migrate history. Older local databases created with `prisma db push` should be recreated or baselined before using migrate deploy.

Railway deployment settings:

- Build: Dockerfile
- Pre-deploy command: `npm run db:migrate:deploy`
- Start command: `npm run start`
- Healthcheck path: `/readyz`

Release order:

1. Merge PR into `main`.
2. Let Railway deploy `dev`.
3. Validate `/health`, `/livez`, `/readyz`.
4. Validate `/metrics` is reachable by the chosen monitoring path.
5. Promote or redeploy the same commit to `staging`.
6. Run API smoke tests against staging.
7. Create release tag `v0.x.y`.
8. Deploy/promote to `production` only after the beta checklist passes.

## 5. Migration Safety

Rules:

- Do not use `prisma db push` in Railway environments.
- Use only `npm run db:migrate:deploy` for deployed environments.
- Keep migrations additive whenever possible.
- Take a backup before every production migration.
- Prefer forward-fix migrations over destructive rollback.

Pre-production migration checklist:

- Migration applies on a clean database in CI.
- `npm run db:migrate:verify` has passed on the release commit.
- Migration applies on staging.
- App boots and `/readyz` returns 200 after migration.
- Smoke tests pass.
- Backup/restore procedure has been tested recently.

Creating a schema change:

```bash
npx prisma migrate dev --name <short_change_name>
npm run db:migrate:verify
npm run build
```

Never edit an already-applied migration in `main`. Add a new forward migration instead.

## 6. Backup And Restore Drill

Production beta minimum:

- Daily PostgreSQL backups enabled in Railway.
- Manual backup before production migration.
- Restore drill performed before onboarding limited real data.

Restore drill:

1. Create a temporary Railway PostgreSQL service or recovery environment.
2. Restore the selected backup into the temporary database.
3. Point a temporary app service at the restored `DATABASE_URL`.
4. Run `/readyz`.
5. Verify core counts:

```sql
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Condominium";
SELECT COUNT(*) FROM "Membership";
SELECT COUNT(*) FROM "AuditEvent";
```

6. Record restore date, backup source, operator, validation result, and any data gap.

Record drills in `docs/RESTORE_DRILL_LOG.md`.

Manual logical backup option for a pre-migration checkpoint:

```bash
DATABASE_URL="$DATABASE_URL" scripts/db_backup.sh
```

Restore that dump into a disposable recovery database first:

```bash
RECOVERY_DATABASE_URL="$RECOVERY_DATABASE_URL" scripts/db_restore_verify.sh backups/gcv-backup-YYYYMMDD-HHMMSS.dump
```

Only point an app at the restored database after validating row counts and `/readyz`.

## 7. Rollback

Application rollback:

1. Identify the last healthy Railway deployment for the environment.
2. Redeploy the previous healthy commit/deployment.
3. Confirm `/readyz` returns 200.
4. Confirm auth and one core tenant workflow.
5. Record the rollback in release notes.

Database rollback:

- Do not attempt destructive down migrations during an incident.
- If data/schema corruption occurred, restore from backup into a recovery database first.
- Promote restored database only after validation.
- Otherwise, ship a forward-fix migration.

## 8. Secrets Rotation

Rotate immediately after suspected exposure and at least before beta expansion.

Session secret rotation:

1. Generate a new strong random `SESSION_SECRET`.
2. Update Railway environment variable.
3. Redeploy/restart the app.
4. Expect all users to log in again.

Database credential rotation:

1. Rotate Railway PostgreSQL credentials or provision a new database credential.
2. Update `DATABASE_URL`.
3. Redeploy app.
4. Confirm `/readyz`.
5. Revoke old credential if applicable.

OAuth secret rotation:

1. Rotate secret in Google/Microsoft provider console.
2. Update Railway variable.
3. Validate login in staging.
4. Apply to production.

## 9. Incident Kill Switches

Use Railway variables and redeploy/restart:

```env
ENABLE_AI_ASSISTANT=false
ENABLE_GITHUB_INTEGRATION=false
ENABLE_DEMO_EXPORTS=false
```

Use these immediately for:

- Unexpected AI cost spike
- Suspected data exposure through AI context
- GitHub/Gist export misuse
- OAuth provider incident
- Beta tenant incident investigation

## 10. Production Beta Go/No-Go

Go requires:

- CI green on the release commit.
- `staging` smoke tests pass.
- Production `DATABASE_URL` is isolated.
- Daily backups are enabled.
- Restore drill has passed.
- OAuth callbacks use production domain.
- Mock login is unavailable in production.
- AI/export flags are disabled for real-data tenants.
- No high/critical finding is open for auth, tenant isolation, documents, secrets, or migrations.
- `docs/BETA_GO_NO_GO_CHECKLIST.md` is completed and signed off.

No-go if any of these fail.

## 11. Auth Audit Expectations

Authentication events are written to tenant audit logs when a user can be associated with at least one account:

- `auth_login`: password login, mock login outside production-like environments, Google login, Microsoft login, and OAuth account linking.
- `auth_logout`: explicit logout with a valid session cookie.
- `auth_failed`: failed password login for a known user, beta allowlist blocks for a known user, and OAuth attempts that can be mapped back to an existing user.

Unknown e-mail attempts are rejected but are not stored in `AuditEvent` because the current audit table is account-scoped. Treat central security-event storage as a future hardening item before broader public signup.
