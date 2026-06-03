# Session Checkpoint

Last updated: 2026-06-02

## Current State

The repository is being prepared to move GCV Condominio from prototype to SaaS.

Current planning artifacts in `docs/`:

- `GCV_SAAS_IMPLEMENTATION_MASTER_PLAN.md`
- `CODEX_IMPLEMENTATION_PLAYBOOK.md`
- `LEAN_COST_CLOUD_PLAN.md`
- `SESSION_CHECKPOINT.md`
- `IMPLEMENTATION_READINESS_ANSWERS_DRAFT.md`
- `DEVOPS_PIPELINE_AND_OPERATIONS_PLAN.md`
- `MULTI_AGENT_REVIEW_REPORT.md`
- `adr/README.md`
- `adr/ADR_TEMPLATE.md`

Repository status at checkpoint:

- Branch: `main`
- Remote tracking: `origin/main`
- `docs/` is untracked.
- `package-lock.json` is untracked.

## Active Decisions

- Product: operational condominium SaaS system of record.
- Geography/language: Brazil and Portuguese initially.
- MVP customer: professional syndic or small property manager.
- MVP finance: billing tracker/dashboard only; no real boleto, PIX, CNAB, reconciliation, or accounting ledger.
- Database: PostgreSQL.
- ORM/migrations: Prisma.
- API: REST under `/api/v1` with Zod validation and OpenAPI later.
- Runtime: Node.js 24 LTS; Node 22 LTS acceptable only if deployment constraints require it.
- Package manager: npm with committed `package-lock.json`.
- Delivery model: Solo + Codex.
- Cloud target: GCP, introduced progressively.
- Cost posture: Lean but Safe; under USD 100/month before paid customers.
- Implementation strategy: local-first with Docker Compose before cloud deployment.

## Known Risks

- Current app stores operational state in browser `localStorage`.
- Current app does not have production SaaS auth, tenancy, RBAC, audit, or PostgreSQL persistence.
- GitHub/Gist integration is prototype/demo only and must not be production-enabled.
- AI endpoint exists but must not process real tenant data.
- Current AI model must be configurable by environment before production hardening.
- Real resident, financial, OAuth, and document data must not be used yet.

## Current AI Implementation

- Provider: Google Gemini through `@google/genai`.
- Endpoint: `/api/gemini/chat`.
- Secret: `GEMINI_API_KEY`.
- Required next hardening: add `GEMINI_MODEL`, feature flag AI usage, and prevent real tenant data from being sent to the LLM.

## Latest Implementation Control

Primary execution document:

- `docs/GCV_SAAS_IMPLEMENTATION_MASTER_PLAN.md`

Supporting implementation guidance:

- `docs/CODEX_IMPLEMENTATION_PLAYBOOK.md`
- `docs/LEAN_COST_CLOUD_PLAN.md`
- `docs/DEVOPS_PIPELINE_AND_OPERATIONS_PLAN.md`
- `docs/IMPLEMENTATION_READINESS_ANSWERS_DRAFT.md`

## Next Recommended Codex Task

Start Gate 0: DevOps Foundation.

First work package:

```text
Title: Add runtime pin and npm package policy
Gate: DevOps Foundation
Goal: Make Node/npm runtime expectations explicit.
Context Files: package.json, package-lock.json
Non-goals: No framework upgrades, no dependency refactor.
Expected Changes: Add .nvmrc, package.json engines, packageManager.
Acceptance Criteria: Runtime metadata is present and consistent with the master plan.
Verification Commands: node --version, npm --version, npm run lint
Risk/Rollback Notes: Revert runtime metadata if the deployment target cannot support it.
```

