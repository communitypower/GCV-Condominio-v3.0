# Multi-Agent Review Execution Report

Date: 2026-05-31

Scope:

- Repository: `/mnt/c/projects/Sindico 0.2`
- Onboarding document reviewed: `docs/PROJECT_ONBOARDING.md`
- Prompt used: `docs/MULTI_AGENT_REVIEW_PROMPT.md`

## 1. Executive Verdict

GCV Condominio is a strong product prototype with meaningful domain coverage, but it is not yet a SaaS product foundation. The current app demonstrates workflows well, especially for condominium operations, billing, maintenance, assets, reports, AI assistance, and GitHub export. The critical gap is that the prototype has no enforceable system of record, tenant isolation, server-side authorization, durable persistence, or production release pipeline.

The project can become a SaaS, but the next phase must be treated as productization architecture, not feature polishing. The highest-leverage work is to define the SaaS operating model, introduce backend-owned domain data, implement identity/RBAC/tenant boundaries, and create CI/runtime discipline before adding more modules.

## 2. Review Method

Six specialist reviewers inspected the repository and onboarding document:

- Solution/Product Architecture
- Frontend Architecture
- Backend/Data Architecture
- Security/Privacy/Compliance
- DevOps/QA/Release
- AI/LLM and Integrations

Additional external verification was performed against official documentation:

- Google AI Gemini model documentation lists supported model codes such as `gemini-2.5-flash`; the reviewed code uses `gemini-3.5-flash`, which should be treated as stale or unverified until tested against the configured API version.
- Google AI structured output documentation supports schema-constrained JSON outputs, which should be used for report generation.
- GitHub OAuth documentation says callback `state` must match the original authorization request; mismatches should abort the flow.
- GitHub Gist documentation states secret gists are not private; anyone with the URL can view them.

References:

- Google Gemini models: https://ai.google.dev/gemini-api/docs/models
- Google Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- GitHub OAuth web flow: https://docs.github.com/apps/building-oauth-apps/authorizing-oauth-apps
- GitHub Gists: https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists

## 3. Critical Path To SaaS

The SaaS transition should follow this order:

1. Runtime and release discipline.
   - Pin Node 20.19+ or Node 22.12+.
   - Commit `package-lock.json`.
   - Add CI for install, typecheck, build, audit, and later tests.

2. Identity, tenancy, and authorization.
   - Replace preset login with real authentication.
   - Model tenant/account/building membership.
   - Enforce RBAC and resident unit scoping on the server.

3. Backend-owned system of record.
   - Introduce PostgreSQL, migrations, and domain APIs.
   - Move Buildings, Units, Billing, Maintenance, Equipment, Users/Roles, and Audit first.

4. Security hardening before real data.
   - Fix GitHub OAuth state/origin/token handling.
   - Remove long-lived provider tokens from `localStorage`.
   - Add request validation, rate limits, CSRF protections, and audit logs.

5. AI/reporting stabilization.
   - Assemble AI context server-side after authorization.
   - Redact or aggregate sensitive data.
   - Use deterministic metrics and structured LLM outputs.

6. Product scope discipline.
   - Classify each module as MVP system-of-record, integration-backed, read-only analytics, or demo-only.

## 4. Top Risks By Severity

### Critical

**No SaaS system of record.** Core data is owned by React state and browser `localStorage`; `server.ts` mainly proxies Gemini/GitHub.

Evidence:

- `src/App.tsx`
- `server.ts`
- `src/initialData.ts`

Action:

- Create backend domain services, persistent schemas, migrations, and typed APIs.

**Tenancy and authorization are simulated.** Multi-building behavior is a client selector, login uses preset users, and access control is UI-only.

Evidence:

- `src/App.tsx`

Action:

- Implement identity provider integration, tenant/building membership, server-side RBAC/ABAC, and authorization tests.

**GitHub OAuth token exfiltration path.** OAuth `state` is generated but not validated, redirect URI is client-controlled, and callback posts provider token to `window.opener` with wildcard target origin.

Evidence:

- `server.ts`
- `src/components/GitHubIntegration.tsx`

Action:

- Bind OAuth state to server session/cookie, allowlist redirect URIs, use strict `targetOrigin`, and store GitHub tokens server-side.

**Unauthenticated Gemini proxy.** `/api/gemini/chat` has no app auth, RBAC, request validation, rate limit, or server-owned context assembly.

Evidence:

- `server.ts`
- `src/components/AIAssistent.tsx`

Action:

- Authenticate the endpoint, assemble context server-side, add role-based filtering, rate limits, request size limits, timeouts, and schema validation.

### High

**Sensitive data and GitHub tokens are stored in `localStorage`.**

Action:

- Move persistence and token custody to the server. Use secure httpOnly cookies or backend-held provider tokens.

**Financial domain is prototype-grade.**

Current billing uses simulated boleto/PIX strings, local payment mutation, hardcoded dates/rates, and static demonstrativos.

Action:

- Define a Finance bounded context with receivables, payables, ledger/accounting events, payment provider integration, reconciliation, and idempotency.

**AI/reporting can expose cross-resident data.**

Resident users can reach AI assistant flows that receive broad building context.

Action:

- Filter by role and unit. Residents should never receive other units' financial status or personal data.

**Several modules are static/local islands.**

Documents, notifications, residents, users, DRE, BIM, and lifecycle cost are useful demos but not durable product capabilities.

Action:

- Mark these explicitly as MVP, later phase, integration-backed, or demo-only.

**Runtime and release are not pinned.**

Current local Node is `18.20.8`; dependencies require Node 20+.

Action:

- Add `.nvmrc` or Volta config, `engines`, and CI on the selected Node version.

**No automated tests.**

Action:

- Add unit tests for billing and maintenance logic, API tests for Gemini/GitHub with mocks, and smoke/e2e boot tests.

### Medium

**Frontend status logic has bugs.**

Maintenance statuses are defined as `reported | in_progress | resolved | cancelled`, but code also checks `completed` and `pending`.

Action:

- Centralize status labels/selectors and remove raw string comparisons.

**Resident portal is hardcoded to `A-101`.**

Action:

- Use `user.unitId` and validate membership against the active building.

**Reset flow can leave state inconsistent.**

Action:

- Replace global `localStorage.clear()` with scoped key deletion and a single reset action that updates all related React state.

**API contracts are untyped and unvalidated.**

Action:

- Add `/api/v1`, Zod/OpenAPI contracts, structured errors, idempotency keys, pagination, and request IDs.

**Deployment readiness is early.**

Hardcoded port, no health endpoint, no graceful shutdown, no env validation, and console-only logging.

Action:

- Use `process.env.PORT`, add `/healthz`, structured logging, graceful shutdown, and startup config validation.

**Gist privacy is overstated.**

GitHub secret gists are unlisted, not private.

Action:

- Do not publish production condominium financial/operational data to Gists. Use controlled object storage or private repository access with auditing.

## 5. Specialist Findings Summary

### Solution/Product Architecture

The onboarding document is accurate about the current prototype, but it needs more decision-level architecture. It should define bounded contexts, tenant/security model, source-of-truth ownership, migration phases, and launch-readiness gates.

Recommended bounded contexts:

- Identity and Tenancy
- Portfolio, Buildings, and Units
- Residents and Owners
- Billing and Collections
- Payables and Procurement
- Maintenance and Assets
- Documents
- Communications
- Reporting and AI
- Integrations
- Audit and Compliance

### Frontend Architecture

`src/App.tsx` owns too much: state loading, mutations, persistence, auth simulation, navigation, notifications, and integrations. This is acceptable for a prototype, but not for team-scale SaaS development.

Recommended frontend moves:

- Extract domain stores/hooks by bounded context.
- Add typed selectors for derived state.
- Replace state-only tabs with URL-backed routing.
- Add accessible modal and form primitives.
- Centralize status labels and role-based navigation metadata.

### Backend/Data Architecture

The backend is currently an integration proxy, not an application backend. The future backend needs to own the domain model.

Recommended data moves:

- PostgreSQL with migrations.
- UUID/ULID primary keys and unique constraints.
- Tenant IDs on all tenant-owned tables.
- Created/updated/deleted metadata.
- Actor attribution and immutable audit events.
- Server-side aging/penalty calculations instead of mutation during UI load.

### Security/Privacy/Compliance

The current implementation must not be used with real resident, financial, OAuth, or operational data without major hardening.

Recommended security moves:

- Real auth and server-side authorization.
- OAuth state validation and strict callback origin.
- Provider tokens stored server-side.
- Secret and PII scanning in CI.
- Data classification for AI/export flows.
- Role-based AI context assembly and redaction.

### DevOps/QA/Release

Release readiness is blocked by runtime mismatch, no CI, no tests, no deployment descriptor, no health endpoint, and untracked generated docs/lockfile.

Recommended release moves:

- Pin Node.
- Commit lockfile.
- Add CI workflow.
- Add test script and baseline tests.
- Add health endpoint.
- Add deployment target config.

### AI/LLM and Integrations

The AI assistant is promising but currently trusts client-supplied context and uses a model ID that appears stale. GitHub integration is useful for demos but risky as a production export path.

Recommended AI/integration moves:

- Move model ID to config.
- Validate supported Gemini model before production.
- Use structured outputs for reports.
- Compute critical metrics outside the LLM.
- Add provider timeouts and typed error handling.
- Rework GitHub integration as either demo-only or a hardened backend integration.

## 6. Required Updates To `PROJECT_ONBOARDING.md`

The onboarding document should be updated with:

- SaaS bounded context map.
- C4-style current and target architecture diagrams.
- Explicit tenant model: account, building, membership, unit, resident.
- Data classification table: public, internal, confidential, sensitive PII, financial.
- Source-of-truth decisions by module.
- Migration plan from `localStorage` to database APIs.
- Security launch gates.
- AI privacy and prompt governance section.
- GitHub Gist correction: secret gists are not private.
- Gemini model correction: avoid hardcoding `gemini-3.5-flash`; use config and verified model IDs.
- CI/release gates and Node version pin.
- Production acceptance checklist.

## 7. 30/60/90 Day Roadmap

### First 30 Days: Foundation

- Pin Node and package manager.
- Commit lockfile and documentation.
- Add CI with install, typecheck, build, audit.
- Add health endpoint and env validation.
- Create architecture decision records for database, auth provider, hosting, and AI provider.
- Define bounded contexts and MVP scope.
- Design initial PostgreSQL schema for tenants, users, roles, buildings, units, billing, maintenance, equipment, and audit.
- Add baseline tests for billing and maintenance logic.

### Days 31-60: System Of Record

- Implement authentication and tenant membership.
- Add backend CRUD APIs for buildings, units, billing, and maintenance.
- Move these modules off `localStorage`.
- Add server-side authorization checks and audit logging.
- Replace client-generated IDs with server-generated IDs.
- Add API validation and structured errors.
- Add smoke/e2e tests for login and core workflows.

### Days 61-90: Product Hardening

- Implement Finance context with ledger-grade receivables/payables foundations.
- Harden AI assistant with server-side context, redaction, structured outputs, and quotas.
- Rework or disable GitHub/Gist export for production data.
- Add documents/notifications persistence or defer them explicitly.
- Add observability: structured logs, request IDs, metrics, provider latency/error tracking.
- Complete production security review and launch-readiness checklist.

## 8. Immediate Next Pull Requests

1. Runtime and CI PR.
   - Add `.nvmrc`, `engines`, `packageManager`.
   - Commit `package-lock.json`.
   - Add GitHub Actions workflow for `npm ci`, `npm run lint`, and `npm run build`.

2. Server readiness PR.
   - Change `PORT` to `process.env.PORT || 3000`.
   - Add `/healthz`.
   - Add env validation.
   - Add request logging.

3. Security containment PR.
   - Disable or label GitHub OAuth/Gist export as demo-only.
   - Add OAuth state validation if keeping it enabled.
   - Remove provider token storage from `localStorage` in production path.

4. Domain correctness PR.
   - Centralize maintenance status helpers.
   - Fix `completed` and `pending` mismatches.
   - Fix resident portal hardcoded `A-101`.
   - Fix reset flow state consistency.

5. Architecture docs PR.
   - Update onboarding with bounded contexts, tenant model, data classification, source-of-truth plan, and production readiness gates.

6. Backend foundation PR.
   - Add database/migration stack.
   - Create initial tenant/building/user/unit schema.
   - Add first typed API endpoints and tests.

## 9. Final Assessment

This is a good prototype at the right moment for architectural discipline. The product surface is broad enough to show market intent, but the next work should intentionally narrow into a production foundation: auth, tenancy, persistence, finance correctness, auditability, AI privacy, and release discipline.

Do not add major new product modules until the system can safely persist, authorize, test, and deploy the core ones.
