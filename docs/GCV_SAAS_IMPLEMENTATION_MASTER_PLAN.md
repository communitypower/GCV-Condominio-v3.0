# GCV SaaS Implementation Master Plan

Date: 2026-06-02

Status: Historical/superseded for beta closure. The current execution source of truth is `docs/PRODUCT_CLOSURE_PLAN.md`, with Railway as the official beta platform.

Basis: repository inspection, multi-agent review, implementation readiness draft, DevOps operations plan, and lean cloud cost decisions. This is an engineering/product implementation plan, not legal, tax, accounting, or financial advice.

## 1. Executive Summary

GCV Condominio will move from a React/Vite/Express prototype into an operational condominium SaaS system of record.

Execution model:

- Team model: Solo + Codex.
- Delivery profile: balanced, with small PR-sized changes.
- Implementation posture: local-first, cloud-later.
- Cloud target: GCP, introduced progressively.
- Budget posture: Lean but Safe, under USD 100/month before paid customers.
- SaaS gates: DevOps Foundation, SaaS Starter, SaaS Intermediate, SaaS Full.

This document is the source of truth for implementation sequence, gates, WBS, cost controls, testing gates, and Codex work packages. Supporting details remain in:

- `docs/IMPLEMENTATION_READINESS_ANSWERS_DRAFT.md`
- `docs/DEVOPS_PIPELINE_AND_OPERATIONS_PLAN.md`
- `docs/MULTI_AGENT_REVIEW_REPORT.md`
- `docs/CODEX_IMPLEMENTATION_PLAYBOOK.md`
- `docs/LEAN_COST_CLOUD_PLAN.md`
- `docs/adr/README.md`

## 2. Current Repository Baseline

Current state:

- React 19 + Vite 6 frontend.
- Express server in `server.ts`.
- Core operational data currently stored in browser `localStorage`.
- Seed/demo data exists in frontend TypeScript files.
- Gemini endpoint exists at `/api/gemini/chat`.
- Current AI implementation uses Google Gemini through `@google/genai`; model selection must be configurable by environment before production use.
- GitHub OAuth/Gist integration exists as prototype/demo functionality only.
- No production SaaS authentication, tenant-safe authorization, PostgreSQL persistence, RBAC/ABAC enforcement, CI workflow, Dockerfile, Docker Compose stack, or cloud deployment is currently established.

Current risk baseline:

- Do not use real tenant, resident, financial, OAuth, document, or operational data yet.
- Do not treat local browser data as production state.
- Do not enable production GitHub/Gist export paths.
- Do not send real tenant data to an LLM until RBAC, redaction, retention, provider terms, and LGPD review are approved.

## 3. Implementation Principles For Codex

Codex must implement this project through small, testable, reversible work packages.

Rules:

- One bounded concern per task.
- Prefer local implementation and CI validation before cloud changes.
- Keep changes PR-sized and easy to review.
- Preserve existing user-visible behavior unless the work package explicitly changes it.
- Do not introduce real tenant data.
- Do not increase cloud cost or create always-on managed services without an approved gate.
- Do not add production AI, GitHub, Gist, payment, or banking behavior without explicit approval.
- Add or update tests in proportion to risk.
- Run verification commands and report failures honestly.

Every Codex work package must define:

- Goal
- Context files
- Non-goals
- Expected changes
- Acceptance criteria
- Verification commands
- Risk/rollback notes

## 4. Target Architecture

Local architecture:

- Node.js 24 LTS, with Node 22 LTS acceptable only if deployment constraints require it.
- npm with committed `package-lock.json`.
- Docker Compose for local app dependencies.
- Local PostgreSQL as the first system-of-record development database.
- Optional local service emulators for mail and object storage when needed.

Application architecture:

- Backend API: REST under `/api/v1`.
- Validation: Zod.
- API documentation: OpenAPI generation after the API shape stabilizes.
- Database: PostgreSQL.
- ORM/migrations: Prisma for MVP velocity.
- Sessions: secure server-managed sessions with `HttpOnly`, `Secure`, `SameSite` cookies.
- Authorization: server-side RBAC/ABAC with tenant, condominium, building, unit, and role scoping.

Progressive cloud architecture:

- Cloud Run for app hosting, introduced first for dev validation with min instances 0.
- Cloud SQL PostgreSQL only when a gate requires cloud database validation, staging migration rehearsals, or real pilot data.
- Google Cloud Storage only when document ACL/upload workflow is ready.
- Secret Manager for cloud secrets.
- Cloud Logging/Monitoring with short non-production retention and cost alerts.

AI architecture:

- Keep Google Gemini initially because the code already uses it.
- Move model ID to configuration, for example `GEMINI_MODEL`.
- Route future AI through a provider abstraction, not UI-specific endpoints.
- Use synthetic/demo data only until legal/security/product approval.

## 5. SaaS Gates

### Gate 0: DevOps Foundation

Purpose: make the repo reproducible, testable, and locally runnable.

Implementation scope:

- Add `.nvmrc`.
- Add `engines` and `packageManager` to `package.json`.
- Commit/use `package-lock.json`.
- Add baseline GitHub Actions CI.
- Add Dockerfile.
- Add local Docker Compose with PostgreSQL.
- Add health endpoint.
- Make Gemini model configurable by environment.
- Disable production GitHub/Gist behavior behind configuration.

Pass criteria:

- `npm ci` works in CI.
- Typecheck/build gate is defined.
- Dependency audit and secret scan gates are defined.
- App can run locally.
- Container can build locally or in CI.
- Local PostgreSQL is available through Docker Compose.
- Health endpoint returns success.
- No real tenant data is required.
- Estimated monthly cloud cost remains USD 0-50 unless an optional Cloud Run dev deployment is explicitly used.

### Gate 1: SaaS Starter

Purpose: establish tenant-safe backend foundations with synthetic data.

Implementation scope:

- Managed auth decision recorded by ADR or approved local placeholder for development only.
- Account/tenant shell.
- PostgreSQL/Prisma schema for first persistent entities.
- API adapters for incremental UI migration.
- Server-side tenant/RBAC checks for first workflows.
- Synthetic seed data only.

Pass criteria:

- Starter workflows pass using synthetic data.
- Tenant/RBAC positive and negative tests pass.
- Prisma migration test passes.
- CI remains green.
- No production customer data exists.
- Cloud Run dev, if enabled, uses min instances 0 and capped max instances.
- Monthly projected cloud bill remains below USD 100.

### Gate 2: SaaS Intermediate

Purpose: prepare staging and realistic operational workflows before pilot tenants.

Implementation scope:

- Staging Cloud Run only after approval.
- Cloud SQL only if needed for migration rehearsals, staging fidelity, or pilot readiness.
- Document storage workflow with ACLs.
- Stronger monitoring and alerts.
- Backup/restore procedure for staging or pilot data.
- Playwright smoke coverage for critical workflows.

Pass criteria:

- Staging validates the same image artifact intended for release.
- Migration rehearsal passes.
- Document access controls pass negative tests.
- Backup/restore drill passes before real data.
- Cost re-evaluation is approved before exceeding USD 100/month.
- Target budget after approval: USD 150-500/month.

### Gate 3: SaaS Full

Purpose: paid-customer readiness.

Implementation scope:

- Production Cloud Run.
- Production Cloud SQL with backups/PITR.
- Production GCS.
- Cloud monitoring and alerting.
- Release approvals.
- Incident response runbook.
- Security review and penetration test planning.

Pass criteria:

- Production deployment is CI/CD controlled.
- Restore drill has passed.
- RBAC/tenant isolation tests pass.
- AI real-data use remains disabled unless separately approved.
- High/critical security findings are resolved or formally accepted.
- Production budget is business-driven and no longer constrained to USD 100/month.

## 6. WBS And Implementation Sequence

### Workstream A: Runtime, CI, Docker, Local Development

Deliverables:

- Runtime pin.
- npm lockfile policy.
- Baseline CI.
- Dockerfile.
- Docker Compose with PostgreSQL.
- Health endpoint.

Quality parameters:

- Reproducible install.
- No untracked generated runtime artifacts required to run.
- CI is the minimum merge gate.

### Workstream B: Auth, Session, Tenant Shell

Deliverables:

- Auth provider ADR.
- Session strategy.
- Account/tenant context.
- Role and membership foundation.

Quality parameters:

- No tokens in `localStorage`.
- Server enforces permissions.
- Tenant switching cannot leak data.

### Workstream C: PostgreSQL, Prisma, Domain Persistence

Deliverables:

- Prisma setup.
- Initial schema and migrations.
- Seed strategy.
- Repository/service adapters.

Quality parameters:

- Migration tests pass.
- Data owned by PostgreSQL, not browser storage.
- Synthetic fixtures only.

### Workstream D: Units, Residents, Memberships

Deliverables:

- Account, condominium, building, unit, person, relationship, user, and membership APIs.
- UI migration for first operational CRUD.

Quality parameters:

- Historical relationships preserved.
- Tenant and role scoping tested.

### Workstream E: Maintenance, Equipment, Billing Tracker

Deliverables:

- Maintenance ticket lifecycle.
- Equipment registry.
- Maintenance plan MVP-lite.
- Billing tracker and manual payment status.

Quality parameters:

- Billing remains tracker/dashboard only.
- No real boleto, PIX, CNAB, reconciliation, or accounting ledger.
- Audit events for status changes.

### Workstream F: Documents, Notifications, Audit

Deliverables:

- Document metadata and version records.
- Role-scoped document access.
- In-app/email-lite notification foundation.
- Audit event visibility for admins/auditors.

Quality parameters:

- Uploads are synthetic until privacy/security review.
- Deletion is soft-delete unless explicitly allowed.

### Workstream G: AI Hardening And Provider Abstraction

Deliverables:

- Configurable Gemini model.
- AI feature flag.
- Server-side context assembly.
- Provider adapter boundary.
- Redaction and quota plan.

Quality parameters:

- No real tenant data to LLM.
- Deterministic calculations remain outside the LLM.
- AI outputs require human review before publishing/export.

### Workstream H: Cloud Deployment And Operations

Deliverables:

- Cloud Run dev deploy workflow.
- Workload Identity Federation.
- Secret Manager integration.
- Staging/prod workflows after gates.
- Monitoring, logs, alerts, backup/restore.

Quality parameters:

- Build once, promote same image digest.
- No direct production deploys from a developer machine.
- Cloud resources are labeled and budget-controlled.

## 7. Cost And Cloud Controls

Default controls:

- Local-first by default.
- Cloud Run min instances 0.
- Dev/staging max instances capped low.
- Request-based CPU billing.
- No Cloud SQL until justified by gate criteria.
- No Redis/Memorystore initially.
- No always-on workers initially.
- No production GCS until document ACL flow exists.
- No real-data AI.
- Short non-production log retention.
- Lifecycle deletion for synthetic storage objects.
- Budget alerts at 50%, 75%, 90%, 100%, and 110%.
- Weekly cost review during buildout.

Cost targets:

- DevOps Foundation: USD 0-50/month.
- SaaS Starter: under USD 100/month.
- SaaS Intermediate: USD 150-500/month only after approval.
- SaaS Full: paid-customer budget based on business needs.

## 8. Testing And Quality Gates

Minimum gates:

- `npm ci`
- Typecheck/build
- Dependency audit
- Secret scan
- SAST
- Docker build
- Health endpoint test

Later gates:

- Prisma migration test
- API tests
- RBAC/tenant positive tests
- RBAC/tenant negative tests
- Playwright smoke tests
- Accessibility baseline checks
- Backup/restore drill before real data
- PII fixture scan

No SaaS gate may pass with unresolved high/critical security findings unless the risk is explicitly accepted by the owner.

## 9. Codex Work Package Template

Use this template for every implementation task:

```text
Title:
Gate:
Goal:
Context Files:
Non-goals:
Expected Changes:
Acceptance Criteria:
Verification Commands:
Risk/Rollback Notes:
```

Example:

```text
Title: Add runtime pin and npm package policy
Gate: DevOps Foundation
Goal: Make Node/npm runtime expectations explicit.
Context Files: package.json, package-lock.json
Non-goals: No framework upgrades, no dependency refactor.
Expected Changes: Add .nvmrc, package.json engines, packageManager.
Acceptance Criteria: npm install path is documented and CI can use npm ci.
Verification Commands: node --version, npm --version, npm run lint
Risk/Rollback Notes: Revert runtime metadata if deployment target cannot support it.
```

## 10. Next Codex Implementation Queue

Execute in this order:

1. Add `.nvmrc`.
2. Add `engines` and `packageManager` to `package.json`.
3. Commit/use `package-lock.json`.
4. Add baseline GitHub Actions CI.
5. Add Dockerfile.
6. Add local Docker Compose with PostgreSQL.
7. Add health endpoint.
8. Make Gemini model configurable by environment.
9. Disable production GitHub/Gist behavior behind configuration.

## 11. Implementation Readiness Checklist

Before starting production domain implementation:

- P0 ADR owners assigned.
- MVP module table approved.
- Tenant hierarchy approved.
- Role/permission matrix approved.
- Auth provider selected or development-only placeholder explicitly approved.
- PostgreSQL + Prisma confirmed.
- Billing tracker-only posture confirmed.
- AI no-real-data policy confirmed.
- GitHub/Gist demo-only policy confirmed.
- Lean cloud cost plan accepted.
