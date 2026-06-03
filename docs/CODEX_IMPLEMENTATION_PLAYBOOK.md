# Codex Implementation Playbook

Date: 2026-06-02

Status: Active implementation guidance

Purpose: define how Codex/GPT should implement GCV SaaS safely, locally first, and in small auditable steps.

## 1. Operating Rules

Codex should:

- Read the relevant files before editing.
- Prefer existing project patterns.
- Keep each task small, PR-sized, testable, and reversible.
- Make one bounded change per implementation turn.
- Preserve user-visible behavior unless the task explicitly changes it.
- Update docs when implementation behavior changes.
- Run verification commands and report failures.
- Avoid cloud work until the relevant SaaS gate approves it.

Codex must not:

- Use real tenant, resident, financial, OAuth, document, or operational data.
- Store auth or provider tokens in `localStorage`.
- Enable production GitHub/Gist export behavior.
- Send real tenant data to an LLM.
- Create always-on cloud resources without an approved gate.
- Introduce payment, boleto, PIX, CNAB, reconciliation, or formal accounting behavior in MVP.

## 2. Required Work Package Format

Every implementation task should be framed like this:

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

The implementer should not need to invent missing decisions. If a decision is missing, pause and record the smallest safe default or ask for approval.

## 3. Local-First Implementation Workflow

Default flow:

1. Inspect relevant files with `rg`, `sed`, or equivalent.
2. Identify the smallest safe change.
3. Edit only files required by the task.
4. Run targeted verification.
5. Run broader checks when the change touches shared behavior.
6. Summarize changes, verification, and known residual risk.

Local-first means:

- Build and test locally before cloud.
- Use Docker Compose for local PostgreSQL.
- Use synthetic data only.
- Add cloud deployment only after local and CI gates are stable.

## 4. SaaS Gate Discipline

DevOps Foundation tasks may touch runtime, package metadata, CI, Docker, local Compose, health checks, and configuration.

SaaS Starter tasks may touch tenant shell, auth/session foundations, Prisma/PostgreSQL, first API adapters, synthetic seeds, and RBAC tests.

SaaS Intermediate tasks may touch staging, Cloud SQL, document storage, monitoring, migration rehearsals, Playwright smoke tests, and backup/restore.

SaaS Full tasks may touch production deployment, production database/storage, release approvals, incident response, restore drills, and security review readiness.

If a task crosses a gate, split it.

## 5. Verification Standards

Minimum checks for documentation-only changes:

- `rg` for conflicting terminology.
- Manual review of links and referenced paths.

Minimum checks for runtime/config changes:

- `npm ci` when dependency lock behavior changes.
- `npm run lint`.
- `npm run build` when feasible in the local runtime.

Minimum checks for backend/API changes:

- Typecheck/build.
- API unit/integration test when available.
- Tenant/RBAC negative test when authorization is touched.

Minimum checks for persistence changes:

- Prisma generate/migration validation when Prisma exists.
- Seed and rollback path review.

Minimum checks for cloud changes:

- Dry-run or plan output when available.
- Budget impact note.
- Rollback command or procedure.

## 6. AI Implementation Rules

AI is allowed only for synthetic/demo data until approval.

Required before real data:

- Server-side RBAC and tenant scoping.
- Redaction.
- Retention policy.
- Provider terms review.
- LGPD review.
- Rate limits and quotas.
- Human review before publishing/exporting AI reports.

Implementation guidance:

- Make model ID configurable by environment.
- Do not hardcode model IDs in business logic.
- Keep deterministic financial, SLA, compliance, and count calculations outside the LLM.
- Prefer an internal `/api/ai/*` abstraction before adding more providers.

## 7. Cost Control Rules

Codex must preserve the lean cloud plan:

- Keep local Docker Compose as default.
- Use Cloud Run min instances 0 when dev cloud deploy is introduced.
- Do not add Cloud SQL until a gate justifies it.
- Do not add Redis/Memorystore until queues or sessions require it.
- Do not add long log retention in non-production.
- Do not enable real-data AI.
- Label cloud resources with `env`, `service`, `owner`, and `cost_center`.

## 8. Reporting Format

At the end of each implementation task, report:

- What changed.
- What was verified.
- What could not be verified.
- Any risk or follow-up.

Keep the report short and file-specific when useful.

