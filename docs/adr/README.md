# Architecture Decision Records

Status: ADR index

Use this directory for durable architecture decisions. Do not create every ADR before the decision is ready; create ADRs when a choice is approved or implementation needs a stable contract.

## ADR Status Values

- `Proposed`: recommended but not approved.
- `Approved`: accepted and implementation may proceed.
- `Superseded`: replaced by a later ADR.
- `Rejected`: explicitly not adopted.
- `Deferred`: intentionally postponed.

## Required ADR Queue

| ADR | Topic | Draft Decision | Owner | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| ADR-001 | Product mode | Operational SaaS system of record | Product Owner | P0 | Proposed |
| ADR-002 | MVP scope | Core ops + billing tracker; defer real finance/AI/GitHub | Product Owner | P0 | Proposed |
| ADR-003 | Tenant hierarchy | Account -> Condominium -> Building -> Unit -> Relationships | Solution Architect | P0 | Proposed |
| ADR-004 | Auth provider | Managed auth, cookie sessions, MFA for privileged roles | Security/Backend | P0 | Proposed |
| ADR-005 | Authorization | Server-side RBAC/ABAC with tenant/unit scoping | Security/Backend | P0 | Proposed |
| ADR-006 | Database | PostgreSQL + Prisma migrations | Backend | P0 | Proposed |
| ADR-007 | API style | REST `/api/v1`, Zod, OpenAPI, structured errors | Backend | P0 | Proposed |
| ADR-008 | Finance posture | Billing tracker only for MVP | Product/Finance | P0 | Proposed |
| ADR-009 | AI policy | No real tenant data until review; structured outputs later | AI/Security | P1 | Proposed |
| ADR-010 | Export/integrations | GitHub demo-only; controlled object storage exports | Security/Product | P1 | Proposed |
| ADR-011 | Hosting | GCP progressively: local first, Cloud Run, then Cloud SQL/GCS when gates require | DevOps | P0 | Proposed |
| ADR-012 | Release gates | GitHub Actions with tests/scans/build gates | DevOps/QA | P0 | Proposed |

## ADR Creation Rule

Create an ADR only when:

- The decision affects architecture, cost, security, compliance, or long-term implementation.
- The team needs a stable contract before coding.
- The master plan references a gate that requires the decision.

Use `ADR_TEMPLATE.md`.

