# Lean Cost Plan For GCV SaaS Cloud Delivery

Date: 2026-06-02

Status: Active cost-control reference

## 1. Summary

Target pre-customer cloud budget: under USD 100/month.

Optimization posture: Lean but Safe.

Main cost principle: use local Docker Compose, GitHub Actions, and scale-to-zero Cloud Run. Avoid always-on managed services in early phases unless they protect critical data or release safety.

GCP remains the preferred cloud, but it must be adopted progressively.

## 2. Cost-Reduced Architecture

Local first:

- PostgreSQL in Docker Compose.
- Optional Redis only if a later queue/session requirement justifies it.
- Optional mail catcher for local notification testing.
- Optional object-storage emulator when document workflow needs it.

Dev cloud:

- One Cloud Run service only when cloud validation is needed.
- Min instances 0.
- Request-based CPU.
- Small CPU/memory allocation.
- Synthetic data only.

Staging:

- Created only at SaaS Starter/SaaS Intermediate boundary when staging has clear pass/fail criteria.
- Cloud SQL only when migration rehearsals or pilot readiness require it.

Production:

- Created only after SaaS Intermediate passes.
- Budget becomes business-driven after paid-customer readiness.

## 3. Services To Delay

Delay these until a gate approves them:

- Cloud SQL for routine early development.
- Production-like staging.
- Production GCS document storage.
- Redis/Memorystore.
- Always-on workers.
- Long log retention.
- Real-data AI.
- OCR, e-signature, bank/payment integrations, CNAB, boleto, PIX, and reconciliation.

## 4. Controls To Keep Even While Lean

Never remove these controls for cost reasons:

- GitHub Actions CI.
- Secret scanning.
- SAST.
- Dependency audit.
- Docker build.
- Health checks.
- RBAC/tenant tests before real tenant data.
- Backup/restore drill before real data.

## 5. Phase Budgets

### DevOps Foundation

Target: USD 0-50/month.

Implement:

- GitHub Actions CI.
- Node runtime pin.
- Lockfile policy.
- Dockerfile.
- Health endpoint.
- Local Docker Compose with PostgreSQL.
- Optional dev Cloud Run only if needed.

Cost controls:

- No Cloud SQL.
- No staging/prod projects.
- Cloud Run dev min instances 0 if used.
- Minimum practical non-production log retention.
- Budget alerts at 50%, 75%, 90%, 100%, and 110%.

Pass criteria:

- Local Docker stack works.
- CI passes install/typecheck/build/audit/secret scan.
- App can run container locally.
- Cloud Run dev deploy works only if needed.

### SaaS Starter

Target: under USD 100/month.

Implement:

- One low-cost dev Cloud Run service if cloud validation is needed.
- Local PostgreSQL for routine development.
- Ephemeral CI database when API tests require it.
- Small shared dev PostgreSQL or smallest practical Cloud SQL only when necessary.
- GCS bucket only for synthetic document tests.

Cost controls:

- Cloud Run min instances 0.
- Dev max instances capped low, for example 1-3.
- No production min instances.
- No always-allocated CPU.
- No Memorystore.
- No real-data AI.
- Synthetic GCS files deleted by lifecycle rule.
- Labels on every cloud resource: `env`, `service`, `owner`, `cost_center`.

Pass criteria:

- Starter workflows pass using synthetic data.
- Tenant/RBAC tests pass.
- CI remains green.
- Local or low-cost restore drill is documented.
- Monthly projected bill remains below USD 100.

### SaaS Intermediate

Target: USD 150-500/month only after approval.

Increase budget only when:

- Staging must be production-like.
- Cloud SQL is needed for migration rehearsals.
- Document storage needs realistic testing.
- Pilot tenants are close.

Add:

- Staging Cloud Run.
- Cloud SQL with backups/PITR for staging when justified.
- GCS with lifecycle/versioning where needed.
- Cloud Monitoring alerts.

Do not add:

- High-availability database.
- Min instances greater than 0 unless cold starts are unacceptable.
- Long log retention.
- AI usage for real data.

### SaaS Full

Budget: paid-customer business budget.

Add only after pilot/paid readiness:

- Production Cloud Run.
- Production Cloud SQL with PITR.
- Production GCS.
- Stronger monitoring and alerts.
- Monthly restore drills.
- Security review and penetration test path.

## 6. Practical Cost Controls

Cloud Run:

- Use request-based billing.
- Keep min instances 0 in dev/staging unless explicitly approved.
- Cap max instances in dev/staging.
- Start with low CPU/memory.
- Avoid always-allocated CPU unless background work requires it.

Cloud SQL:

- Delay until cloud DB is necessary.
- Start with the smallest acceptable PostgreSQL instance.
- Use non-production stop/suspend windows if feasible.
- Enable PITR only when data value justifies it.

Storage:

- Use lifecycle deletion for dev/staging objects.
- Avoid broad object versioning until document workflows are real.
- Keep uploads synthetic before security/privacy review.

Logging:

- Use short non-production retention.
- Scrub PII.
- Alert on log ingestion spikes.

AI/email:

- Disable AI by default for real data.
- Add per-user and per-tenant quotas before enabling AI.
- Use email sandbox/test mode where possible.

Billing governance:

- Budgets per project/environment.
- Alerts at 50%, 75%, 90%, 100%, and 110%.
- Weekly cost review during buildout.

## 7. Testing Gates To Preserve

Cost reduction must not remove:

- `npm ci`
- Typecheck/build
- Dependency audit
- Secret scan
- SAST
- Docker build
- Health endpoint tests
- Prisma migration test once DB exists
- RBAC/tenant negative tests before real tenant data
- Playwright smoke before staging/pilot
- Backup/restore drill before real data

## 8. Assumptions

- Target budget before paid customers is under USD 100/month.
- GCP remains preferred cloud.
- Local Docker Compose is acceptable for most early development.
- No real tenant data enters the system until SaaS Starter gates pass.
- Cloud costs must be validated with Google Cloud Pricing Calculator before provisioning.

