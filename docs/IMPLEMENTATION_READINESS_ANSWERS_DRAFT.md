# Implementation Readiness Answers Draft

Date: 2026-05-31

Status: Draft for stakeholder review

Basis: multi-agent review, repository inspection, current implementation-readiness questionnaire, and common SaaS/product engineering practice. This is an engineering/product recommendation, not legal, tax, accounting, or financial advice.

Related implementation plans:

- `docs/GCV_SAAS_IMPLEMENTATION_MASTER_PLAN.md`
- `docs/CODEX_IMPLEMENTATION_PLAYBOOK.md`
- `docs/LEAN_COST_CLOUD_PLAN.md`
- `docs/DEVOPS_PIPELINE_AND_OPERATIONS_PLAN.md`

## Executive Defaults

These are the recommended default decisions unless stakeholders override them:

- Product mode: operational condominium management SaaS system of record.
- MVP geography: Brazil only.
- MVP language: Brazilian Portuguese.
- MVP customer: professional syndic or small property manager managing one or more condominiums.
- MVP finance posture: billing tracker and management dashboard, not legal billing/payment/accounting system of record.
- Database: PostgreSQL.
- ORM/migrations: Prisma for MVP velocity.
- Backend API: REST under `/api/v1` with Zod validation and OpenAPI generation.
- Runtime: Node.js 24 LTS, with Node 22 LTS acceptable only if deployment/runtime constraints require it.
- Package manager: npm with committed `package-lock.json` and `npm ci` in CI.
- Hosting default: local-first implementation, then GCP Cloud Run scale-to-zero; Cloud SQL PostgreSQL, Google Cloud Storage, Secret Manager, and Cloud Logging/Monitoring are introduced progressively when SaaS gates justify them.
- Auth default: managed auth; shortlist Auth0, Clerk, or Supabase Auth. If choosing GCP-heavy stack, evaluate Identity Platform too.
- Sessions: secure server-managed sessions with `HttpOnly`, `Secure`, `SameSite` cookies.
- AI: not allowed to process real tenant data until RBAC, redaction, retention, provider terms, and LGPD review are complete.
- GitHub/Gist: demo/developer tooling only; not part of production product.

## 1. Decision Gates

| Gate | Draft Answer | Status |
| --- | --- | --- |
| SaaS scope and MVP boundaries | Operational condominium SaaS system of record for buildings, units, residents, maintenance, assets, documents, audit, and billing status tracking. | Proposed |
| Tenant/building/user model | `Account -> Condominium -> Building/Block -> Unit -> Residents/Owners/Contacts`. Users can hold different roles per account/condominium/unit. | Proposed |
| Authentication and authorization | Managed auth plus server-side RBAC/ABAC and tenant/unit scoping. | Proposed |
| Database/source of truth | PostgreSQL backend is source of truth. No production domain state in `localStorage`. | Proposed |
| Billing/financial responsibility | MVP is tracker/dashboard only. Real boleto/PIX/CNAB/accounting deferred. | Proposed |
| LGPD/security posture | Treat customer as likely controlador and GCV as likely operador; legal must confirm. Add DPA, data classification, audit, retention, incident process. | Needs Legal Review |
| AI data usage | No real tenant data to LLM until legal/security/product approval. | Proposed |
| External integration policy | Only auth, email, storage, DB, and optional AI provider for MVP. GitHub export disabled/demo-only. | Proposed |
| Runtime/deployment | Node 24 LTS locally and in containers; Cloud Run scale-to-zero first; Cloud SQL, GCS, and Secret Manager introduced progressively by SaaS gate. | Proposed |
| CI/testing/release | GitHub Actions: `npm ci`, typecheck, build, unit/API/e2e tests, audit, secret scanning, PII fixture scan. | Proposed |

## 2. How To Answer

Use this decision format for formal approval:

```text
Question:
Decision:
Owner:
Status:
Rationale:
Impacted Modules:
Follow-up:
```

Recommended statuses:

- `Proposed`: default answer in this document.
- `Approved`: stakeholder accepted and implementation may proceed.
- `Needs Legal Review`: legal/privacy/accounting validation required.
- `Deferred`: not in MVP.
- `Rejected`: explicitly not adopted.

Recommended owners:

| Area | Owner |
| --- | --- |
| Product/MVP | Product Owner / Founder |
| Tenant model | Solution Architect |
| Auth/RBAC | Security Lead + Backend Lead |
| Database/API | Backend Lead |
| Finance/billing posture | Product Owner + Finance/Accounting Advisor |
| LGPD/privacy | Privacy Owner / Counsel |
| AI | AI Lead + Privacy Owner |
| DevOps/release | DevOps Lead |
| QA gates | QA Lead + Tech Lead |

## 3. Product And Business Scope

1. **Product mode:** GCV should become an operational SaaS system of record, not just a dashboard.
2. **First paying customer:** professional syndic or small property manager managing multiple condominiums.
3. **MVP promise:** "Help a syndic manage units, residents, maintenance, assets, documents, billing status, and operational history for one or more condominiums with tenant-safe access control."
4. **Mandatory MVP modules:** account/tenant, condominiums/buildings, units, residents/owners/contacts, roles/memberships, maintenance tickets, equipment, maintenance plans, billing tracker, documents, notifications-lite, dashboard, audit.
5. **Demo-only modules for now:** BIM view, lifecycle cost simulator, GitHub integration, AI over real data, Gist export.
6. **Read-only dashboards backed by backend aggregates:** dashboard, demonstrativos, collection metrics, maintenance KPIs, asset health summaries.
7. **Write operations in v1:** buildings, units, residents/contacts, memberships, maintenance tickets, equipment, plans, billing tracker records, manual payment status, documents, announcements.
8. **Top workflows:** condominium setup; maintenance ticket lifecycle; billing status tracking; equipment/inspection management; document upload/access.
9. **Out of scope:** real boleto/PIX issuance, CNAB, bank reconciliation, formal accounting ledger, OCR, e-signature, production BIM, production GitHub export, unrestricted AI reports.
10. **Expected condominiums per account:** start with 1-20; design for 100+ without schema changes.
11. **Expected units per building:** start with 20-300; design for 1,000+ per condominium.
12. **Expected users per customer:** start with 10-500; design for thousands across portfolios.
13. **Launch geography:** Brazil only.
14. **Launch language:** Portuguese only.
15. **Mobile posture:** responsive web required. Mobile-first for residents and staff; desktop-optimized for admin/finance.

## 4. Tenant, Building, And Organization Model

1. **Top-level tenant:** `Account`, representing the paying customer or management organization.
2. **Multiple condominiums per account:** yes.
3. **Multiple buildings/towers per condominium:** yes.
4. **User in multiple accounts:** yes.
5. **Different roles by building/condominium:** yes.
6. **Residents in multiple units:** yes.
7. **Multiple owners/tenants/contacts per unit:** yes.
8. **Renters separate from owners:** yes.
9. **Historical ownership/residency periods:** yes, required for audit and disputes.
10. **Canonical hierarchy:**

```text
Account / Tenant
  Condominium
    Building / Tower / Block
      Unit
        Unit Relationships
          Owner
          Tenant
          Dependent
          Authorized Contact
```

Recommended model notes:

- Keep `Person` separate from `User`. A resident/person may not have login access.
- Keep `UnitRelationship` separate from `Unit` so ownership and tenancy history are preserved.
- Every tenant-owned table should include `account_id` or a resolvable tenant path.

## 5. Users, Roles, And Permissions

1. **Roles required at launch:** platform admin, account owner, syndic/admin, manager/staff, council member, accountant, doorman/staff, vendor/technician, owner, tenant, dependent, auditor.
2. **Are `admin`, `staff`, `resident` enough?** No. Keep them as UI groups only.
3. **Granular roles:** yes.
4. **Who can create users:** account owner and syndic/admin.
5. **Who can invite residents:** syndic/admin and delegated manager/staff.
6. **Who can view billing data:** syndic/admin, accountant, council member read-only, resident for own unit only.
7. **Who can mark a charge as paid:** syndic/admin and accountant; optional delegated manager with permission.
8. **Who can approve purchases:** syndic/admin; council approval optional by threshold.
9. **Who can create payment orders:** syndic/admin and accountant; staff can request only.
10. **Who can view documents:** role-scoped by document category; residents see public/common docs and own-unit docs.
11. **Who can upload/delete documents:** syndic/admin and delegated staff; deletion should be soft-delete.
12. **Who can export reports:** syndic/admin, accountant, council member read-only exports if allowed.
13. **Who can access AI:** post-MVP; admin/accountant only at first, never unrestricted resident AI.
14. **Resident data scope:** residents see only own unit and common building announcements/docs.
15. **Staff financial access:** no by default; grant explicitly if needed.
16. **Audit log visibility:** admins and auditors; residents get only their own access/action history if required.
17. **Approval workflow:** yes for financial changes, exports, role changes, document deletion, purchase approval, and period close/reopen.

Minimum permission matrix:

| Capability | Admin | Staff | Resident | Notes |
| --- | --- | --- | --- | --- |
| View dashboard | Yes | Limited | Own/common only | Role-scoped |
| Manage buildings | Yes | No | No | Admin only |
| Manage units | Yes | Limited edit if delegated | No | Audit required |
| View all residents | Yes | Limited | No | Need-to-know |
| View own unit | Yes | If assigned | Yes | Resident own unit only |
| View all billing | Yes | No by default | No | Accountant/council may read |
| View own billing | Yes | No | Yes | Tenant/owner policy applies |
| Mark payment | Yes | No by default | No | Accountant can |
| Open maintenance ticket | Yes | Yes | Yes | Residents own/common |
| Manage maintenance ticket | Yes | Yes | Own ticket comments only | Staff role |
| Approve purchase | Yes | No | No | Council approval optional |
| Export reports | Yes | No by default | No | Audited |
| Use AI assistant | Post-MVP | No | No | Admin beta only |

## 6. Authentication And Account Access

1. **Auth provider:** managed auth. Recommended shortlist: Auth0, Clerk, Supabase Auth, or Google Identity Platform.
2. **Login method:** email/password plus magic link or password reset. Add Google/Microsoft later for business users.
3. **MFA:** required for admins, account owners, accountants, council members, exports, and financial access.
4. **Resident registration:** invitation-only.
5. **User-to-unit matching:** admin-created or imported unit relationships; resident claim flow only with admin approval.
6. **Session type:** secure cookie-based sessions; no tokens in `localStorage`.
7. **Session timeout:** 8-12 hours for admins/staff; 30 days remember-me for residents only if risk accepted; step-up auth for sensitive actions.
8. **SSO:** not MVP, but architecture should allow it.
9. **Account recovery:** required at launch through provider workflow.
10. **Inactive residents:** keep historical relationship, disable login or restrict to historical documents as policy decides.

Recommended auth implementation rule:

- UI role checks improve UX, but every permission must be enforced server-side.

## 7. Data Ownership And Persistence

1. **Database:** PostgreSQL.
2. **Approve PostgreSQL default:** yes.
3. **ORM/migration tool:** Prisma for MVP; revisit if advanced SQL/event sourcing dominates later.
4. **Entities moved first:** account, user, membership, condominium, building, unit, person, unit relationship, audit event.
5. **Auditable data:** all auth, membership, unit, resident, billing, payment status, maintenance, document, export, AI, integration, and deletion actions.
6. **Hard-delete:** only synthetic demo data and clearly non-regulated transient records.
7. **Soft-delete:** users, persons, units, buildings, documents, tickets, billing records.
8. **Historical versioning:** ownership/residency, role changes, billing status, payment status, ticket status, document versions.
9. **Backup/restore:** automated encrypted backups, point-in-time recovery, restore drills before beta.
10. **Retention:** proposed defaults below; legal/accounting review required.
11. **Seed/demo data:** mark synthetic and replace realistic personal data with safe fictional fixtures.
12. **Import tools:** yes, CSV/XLSX for units, residents, equipment, charges.
13. **Import/export formats:** CSV and XLSX for MVP; PDF reports later.

Recommended first persistent entities:

- `accounts`
- `users`
- `memberships`
- `roles`
- `permissions`
- `condominiums`
- `buildings`
- `units`
- `persons`
- `unit_relationships`
- `billing_periods`
- `charges`
- `charge_line_items`
- `payment_records`
- `maintenance_tickets`
- `ticket_comments`
- `ticket_status_history`
- `equipment`
- `maintenance_plans`
- `documents`
- `document_versions`
- `audit_events`

## 8. Financial And Billing Domain

1. **Responsibility:** MVP tracks billing/collections; it does not legally issue or process payments.
2. **Real boletos:** no for MVP.
3. **Real PIX charges:** no for MVP.
4. **Provider:** deferred. Later evaluate Asaas, Iugu, Banco Inter, PJBank, Stark Bank, or direct bank integrations.
5. **Legal issuer:** deferred; likely condominium/customer or payment provider arrangement.
6. **Reconciliation:** manual in MVP.
7. **Bank statement import:** no for MVP; phase 2.
8. **CNAB:** no for MVP.
9. **Rules:** due date, manual status, notes, basic penalty/interest preview only. Do not mutate ledger-like state automatically.
10. **Billing rules:** per condominium, with optional unit type/unit overrides.
11. **Fractional share:** store now; use for calculations later.
12. **Extra charges:** yes, as tracked line items.
13. **Recurring monthly charges:** yes, as generated draft charges.
14. **One-off charges:** yes.
15. **Split payments:** no for MVP.
16. **Refunds/reversals:** no for MVP; status correction with audit only.
17. **Formal ledger:** no for MVP.
18. **Chart of accounts:** no for MVP; define categories only.
19. **Demonstrativos:** management views, not official accounting statements.
20. **Close/reopen period:** syndic/admin and accountant only; audit required.

Blocking decision answer:

- MVP is a financial tracker/dashboard, not a financial system of record.

## 9. Maintenance, Assets, And Operations

1. **Canonical workflow:** `reported -> triaged -> approved -> in_progress -> waiting_vendor -> resolved`; `cancelled` can exit from pre-resolution states.
2. **Required statuses:** reported, triaged, approved, in_progress, waiting_vendor, resolved, cancelled.
3. **Who can open tickets:** residents, staff, admins.
4. **Common area tickets:** yes.
5. **Staff assignment:** admin/manager assigns; staff can self-update if assigned.
6. **Vendors:** model as vendor companies/contacts first; vendor user login later.
7. **Approval before work:** required for cost-bearing tickets above threshold.
8. **Budget threshold:** configurable by condominium; start default at R$ 500 for approval.
9. **SLA rules:** simple priority-based SLA in MVP; advanced SLA later.
10. **Photos/files:** yes, through document/attachment storage.
11. **Internal comments:** yes.
12. **Equipment history:** immutable event/status history.
13. **Preventive plans:** yes, MVP-lite.
14. **Auto-generate work orders:** phase 2 unless maintenance is the primary pilot focus.
15. **Equipment categories:** elevators, pumps, electrical, hydraulic, security/access, fire safety, HVAC, garden/pool, structure, common areas, other.
16. **QR tagging:** store QR/tag field in MVP; physical tagging phase 2.
17. **BIM:** visual dashboard/demo only; no real BIM integration for MVP.

## 10. Documents And File Storage

1. **MVP documents:** convention/regulation, meeting minutes, manuals, technical reports, maintenance attachments, billing/payment attachments, notices.
2. **User uploads:** yes, role-scoped.
3. **Generated documents:** basic PDF/CSV exports later; not launch blocker.
4. **Allowed file types:** PDF, JPG, PNG, CSV, XLSX, DOCX initially.
5. **Max file size:** 25 MB default; configurable later.
6. **Storage:** Google Cloud Storage if using GCP; otherwise S3-compatible storage.
7. **Virus scanning:** required before real customer uploads are enabled.
8. **Access control:** yes, by account, condominium, building, unit, role, and document category.
9. **Expiration dates:** optional metadata; required for certificates/inspection reports later.
10. **Legal signatures:** deferred.
11. **OCR/search:** deferred.
12. **Versioning:** yes, document version records from start.

## 11. Notifications And Communications

1. **Channels:** in-app and email for MVP. WhatsApp/SMS phase 2 with opt-in.
2. **MVP notifications:** invites, ticket updates, billing due/overdue reminder, document published, announcement posted.
3. **Announcements:** yes.
4. **Who can send:** admins and delegated managers.
5. **Approvals:** required for urgent or all-resident announcements if configured.
6. **Receipts:** basic sent/read for in-app; email delivery later.
7. **Urgent notices:** yes, visibly distinguished and audited.
8. **Provider:** email via Resend, SendGrid, Mailgun, or GCP-compatible provider; decide in ADR.
9. **Opt-in/out:** required for optional marketing/WhatsApp/SMS; transactional notices follow legal/contract basis.
10. **History retention:** retain sent communications with audit for at least 1 year; legal review for exact period.

## 12. AI Assistant And Reporting

1. **AI MVP status:** post-MVP/admin beta, not core MVP.
2. **Roles:** admin/accountant/council only at first; no residents until strict scoping exists.
3. **Data to LLM:** synthetic/demo only until approved; later server-filtered, redacted, role-scoped data.
4. **PII redaction:** yes by default.
5. **Financial values:** aggregate/scoped only; raw payment data blocked unless approved.
6. **Scope:** role-scoped data only.
7. **Logging:** metadata logs yes; raw prompt/response logs only if legal/privacy approve.
8. **Retention:** redacted AI metadata 90 days; raw troubleshooting logs shorter and disabled by default.
9. **Provider/model:** Google Gemini can remain because code already uses it; configure model by env. Default candidate: `gemini-2.5-flash` unless updated provider docs/contract require another stable model.
10. **Configurable model ID:** yes.
11. **Structured outputs:** yes for reports.
12. **Deterministic calculations:** all financial totals, collection rates, overdue counts, SLA stats, equipment counts, and compliance dates.
13. **Disclaimers:** AI reports are advisory summaries and require human review.
14. **Human approval:** required before publishing/exporting AI reports.
15. **Rate limits:** per user, tenant, and endpoint; strict quotas before beta.

Blocking policy answer:

- No real tenant data should be sent to an LLM until authorization, redaction, retention, provider terms, and LGPD review are approved.

## 13. GitHub And External Integrations

1. **GitHub integration:** demo/developer tooling only.
2. **GitHub OAuth production:** no for product v1.
3. **Gist export:** no. Secret gists are not private.
4. **If GitHub remains later:** prefer GitHub App with fine-grained permissions and backend-held tokens.
5. **Provider token storage:** backend encrypted storage only; never `localStorage`.
6. **Launch integrations:** auth provider, email, object storage, database, logging/monitoring. AI only for synthetic/admin beta.
7. **Categories later:** bank/payment, WhatsApp, accounting/ERP, OCR, e-signature.
8. **Failure blocking:** auth and database failures block; email/notification failures should queue/retry; AI failures should not block core operations.
9. **Retry policy:** exponential backoff for transient provider failures; idempotency keys for create/payment-like operations.
10. **Audit:** every export, integration link/unlink, token refresh/failure, and external publish action.

## 14. Security, Privacy, And LGPD

1. **Controller:** likely condominium/property manager/customer.
2. **Processor/operator:** likely GCV, unless GCV determines purposes of processing. Legal must confirm.
3. **Personal data:** names, emails, phones, addresses/unit links, documents, tickets, vehicle plates, pets, dependents, access contacts.
4. **Sensitive personal data:** avoid collecting in MVP. If documents contain sensitive data, classify by document.
5. **Financial data:** charges, due dates, status, payment records, payables, reports.
6. **Legal basis:** legal review required; likely contract/legal obligation/legitimate interest for core operations; consent for optional channels/marketing.
7. **Consent flows:** optional WhatsApp/SMS, marketing, optional AI features, and any nonessential communications.
8. **Data subject rights:** provide request channel for access, correction, deletion/anonymization, portability/export where applicable.
9. **Retention:** proposed table below; legal must approve.
10. **Deletion/anonymization:** soft-delete operational records; anonymize when retention expires and legal obligations allow.
11. **DPO/privacy owner:** assign before beta.
12. **DPIA/RIPD:** legal decision; recommended before AI on real data, financial processing, or large-scale production launch.
13. **Mandatory audit events:** auth, roles, resident/unit CRUD, billing/payment mutations, documents, exports, AI reports, integration tokens, data deletion.
14. **Controls before beta:** TLS, encryption at rest, encrypted backups, secrets manager, RBAC/tenant tests, rate limiting, CSRF/CORS, request validation, audit logs, dependency/secret scanning.
15. **Encryption at rest:** yes.
16. **Field-level encryption:** evaluate for provider tokens and high-risk PII; required for external integration tokens.
17. **Incident response:** written runbook before beta.
18. **Encrypted backups:** yes.
19. **Penetration test:** required before paid production.
20. **Compliance path:** LGPD first; SOC 2/ISO 27001 later if enterprise customers require it.

Data classification draft:

| Data Type | Classification | Who Can Access | Retention | Can AI Use? | Can Export? |
| --- | --- | --- | --- | --- | --- |
| Resident name | Confidential PII | Admin, scoped staff, own resident | Active + 5 years proposed | Redacted/scoped only | Controlled |
| Resident email/phone | Restricted PII | Admin, scoped staff, own resident | Active + 5 years proposed | No raw use | Controlled/minimized |
| Unit ownership | Confidential | Admin, council/accountant read, own owner | Historical retention required | Aggregated/scoped | Controlled |
| Billing status | Restricted financial | Admin, accountant, council read, own resident | 5 years minimum proposed | Aggregated/scoped | Controlled, never Gist |
| Payment records | Restricted financial | Admin/accountant only, own resident limited | 5 years minimum proposed | No raw use | Controlled |
| Maintenance tickets | Confidential | Admin, staff, requester, assigned users | 5 years proposed | Scoped/redacted | Controlled |
| Operational logs | Internal/confidential | Admin, auditor, scoped staff | 1-5 years by type | Scoped summaries | Controlled |
| Documents | By content | Role/category scoped | By category | No unless approved | Controlled |
| AI prompts/responses | Confidential audit data | Admin/audit/security only | 90 days redacted metadata | N/A | No by default |

## 15. Infrastructure, Deployment, And Operations

1. **Hosting:** local-first during implementation; GCP Cloud Run for cloud validation and production.
2. **Cloud:** GCP by default, aligned with current AI Studio/Cloud Run hints and Gemini use, but adopted progressively to control cost.
3. **Docker:** yes.
4. **Single Node app:** acceptable for v1.
5. **Split frontend/backend:** defer until team/scale demands it.
6. **Environments:** local, dev, staging, production.
7. **Secrets manager:** local ignored env files for development; Google Secret Manager for cloud environments.
8. **Logging:** Cloud Logging with structured JSON logs.
9. **Monitoring:** Cloud Monitoring plus uptime checks and alerts.
10. **Uptime target:** beta 99.0%; paid v1 99.5% initial target.
11. **Backup frequency:** daily plus PITR for PostgreSQL.
12. **RTO:** initial 4 hours.
13. **RPO:** initial 24 hours; tighten after paid launch.
14. **Domain/SSL:** managed HTTPS through Cloud Run/load balancer or chosen DNS/CDN.
15. **Deployment approval:** dev automatic; staging automatic after CI; production tagged release with manual approval.

Runtime decisions:

| Decision | Recommended Answer |
| --- | --- |
| Node version | Node 24 LTS |
| Package manager | npm |
| CI provider | GitHub Actions |
| Hosting provider | Local Docker first; GCP Cloud Run when gates require cloud validation |
| Database provider | Local PostgreSQL first; Cloud SQL PostgreSQL when gates require cloud database validation or real pilot data |
| Storage provider | Local/synthetic storage first; Google Cloud Storage when document ACL/upload flow is ready |
| Monitoring provider | Cloud Monitoring/Logging |

## 16. Testing And Quality Gates

1. **Coverage target:** do not chase percentage first; require tests for critical workflows. Later target 70%+ for domain/backend.
2. **Required workflow tests:** auth/session, tenant switching, unit/resident CRUD, maintenance lifecycle, billing tracker, document access, role restrictions.
3. **Playwright/e2e:** yes for smoke and critical paths.
4. **Visual regression:** deferred; add after UI stabilizes.
5. **Accessibility:** yes; baseline automated checks and manual modal/form review.
6. **Security scanning:** yes in CI.
7. **Dependency auditing:** yes in CI.
8. **PR reviews:** mandatory.
9. **ADRs:** mandatory for major architecture/product decisions.
10. **Definition of done:** typed code, migrations, tests, audit behavior, role/tenant authorization, staging validation, docs updated, no unresolved high/critical CI findings.

Minimum CI gates:

- `npm ci`
- `npm run lint`
- `npm run build`
- Unit tests
- API tests
- Playwright smoke tests
- Dependency audit
- Secret scanning
- PII fixture scanning

Recommended test stack:

- Vitest
- React Testing Library
- Supertest
- Playwright
- ESLint or Biome after initial runtime stabilization

## 17. Migration From Prototype

1. **Migrate current `localStorage`:** no, discard as prototype/demo unless explicitly requested.
2. **Seed data:** treat as synthetic; replace realistic fixtures.
3. **Demo mode:** yes, keep separate from production tenants.
4. **Preserve temporarily:** UI shell, dashboard components, maintenance UI patterns, billing tracker UX, equipment UI.
5. **Rewrite before production:** auth, persistence, GitHub OAuth/Gist, AI context assembly, localStorage stores.
6. **Stable workflows:** login shell, building switch, unit list/detail, maintenance ticket, billing list/status, equipment list.
7. **API adapters:** yes, introduce service/adapters so UI migration is incremental.
8. **First module to migrate:** buildings and units, after auth/tenant shell.
9. **Feature flags:** use config/env flags first; add feature flag service later if needed.
10. **Domain validation:** product owner plus syndic/domain specialist.

Recommended migration order remains:

1. Runtime/CI foundation
2. Auth/tenancy shell
3. Buildings and units
4. Users, residents, and memberships
5. Maintenance tickets
6. Equipment and maintenance plans
7. Billing and payments tracker
8. Documents and notifications
9. AI and reporting
10. External integrations

## 18. MVP Definition Worksheet

| Module | MVP? | Source Of Truth | Write Support? | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Yes | Backend aggregates | No direct writes | Product/Frontend | Role-scoped |
| Buildings | Yes | PostgreSQL | Yes | Backend | Tenant-scoped |
| Units | Yes | PostgreSQL | Yes | Backend | Include fractional share |
| Residents/owners | Yes | PostgreSQL | Yes | Backend/Product | Person + relationship model |
| Billing | Yes | PostgreSQL | Limited | Product/Finance | Tracker only |
| Payments | Limited | PostgreSQL | Manual status only | Product/Finance | No real processing |
| Maintenance tickets | Yes | PostgreSQL | Yes | Product/Backend | Core workflow |
| Equipment | Yes | PostgreSQL | Yes | Product/Backend | Asset registry |
| Maintenance plans | MVP-lite | PostgreSQL | Yes | Product/Backend | Auto work orders later |
| Documents | MVP-lite | Object storage + DB | Yes | Backend/Security | Versioned, ACLs |
| Notifications | MVP-lite | PostgreSQL/events | Yes | Backend/Product | In-app/email |
| Purchase requests | Phase 2/MVP-lite | PostgreSQL | Optional | Product | Only if pilot needs |
| Payment orders | Phase 2 | PostgreSQL later | No for MVP | Finance | Defer |
| Demonstrativos | Read-only | Backend calculations | No | Product/Finance | Management view only |
| BIM view | No | Demo/static | No | Product | Demo-only |
| Lifecycle costs | No | Derived later | No | Product | Later analytics |
| AI assistant | Post-MVP beta | Server-side context | No tenant data initially | AI/Security | Admin beta only |
| GitHub integration | No | None/prototype | No | Engineering | Remove/disable production |

## 19. Architecture Decision Records To Create

| ADR | Draft Decision | Owner | Priority |
| --- | --- | --- | --- |
| ADR-001 Product mode | Operational SaaS system of record | Product Owner | P0 |
| ADR-002 MVP scope | Core ops + billing tracker; defer real finance/AI/GitHub | Product Owner | P0 |
| ADR-003 Tenant hierarchy | Account -> Condominium -> Building -> Unit -> Relationships | Solution Architect | P0 |
| ADR-004 Auth provider | Managed auth, cookie sessions, MFA for privileged roles | Security/Backend | P0 |
| ADR-005 Authorization | Server-side RBAC/ABAC with tenant/unit scoping | Security/Backend | P0 |
| ADR-006 Database | PostgreSQL + Prisma migrations | Backend | P0 |
| ADR-007 API style | REST `/api/v1`, Zod, OpenAPI, structured errors | Backend | P0 |
| ADR-008 Finance posture | Billing tracker only for MVP | Product/Finance | P0 |
| ADR-009 AI policy | No real tenant data until review; structured outputs later | AI/Security | P1 |
| ADR-010 Export/integrations | GitHub demo-only; controlled object storage exports | Security/Product | P1 |
| ADR-011 Hosting | GCP progressively: local first, Cloud Run, then Cloud SQL/GCS when gates require | DevOps | P0 |
| ADR-012 Release gates | GitHub Actions with tests/scans/build gates | DevOps/QA | P0 |

## 20. Implementation Start Criteria

| Criteria | Draft Status |
| --- | --- |
| MVP module table completed | Proposed in this doc |
| Tenant hierarchy approved | Proposed; needs stakeholder approval |
| Role/permission matrix approved | Proposed baseline; needs review |
| Auth provider selected | Open; shortlist provided |
| Database/migration stack selected | Proposed: PostgreSQL + Prisma |
| Source-of-truth decision per MVP module | Proposed in worksheet |
| Financial responsibility level decided | Proposed: tracker only |
| AI data policy decided | Proposed: no real tenant data initially |
| GitHub/export policy decided | Proposed: demo-only/no Gist export |
| Hosting/runtime selected | Proposed: Node 24 LTS + local-first Docker; GCP Cloud Run progressively |
| CI gates defined | Proposed |
| Security/privacy owner assigned | Open |

Implementation may start on runtime/CI/docs only before full approval. Production domain implementation should wait for P0 ADR approval.

## 21. Immediate Workshop Agenda

Recommended 2-hour agenda with draft answers prefilled:

1. Approve or reject product mode: operational SaaS system of record.
2. Approve MVP modules and demo-only modules.
3. Approve tenant hierarchy.
4. Review role/permission matrix.
5. Select auth provider from shortlist.
6. Approve PostgreSQL + Prisma.
7. Confirm billing tracker only for MVP.
8. Confirm no real tenant data to AI for MVP.
9. Confirm GitHub/Gist is demo-only.
10. Confirm GCP Cloud Run stack or name alternative.
11. Assign P0 ADR owners.
12. Assign privacy/security owner.

## References Checked

- Node.js releases: https://nodejs.org/en/about/previous-releases
- Google Gemini models: https://ai.google.dev/gemini-api/docs/models
- Google Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- GitHub OAuth flow: https://docs.github.com/apps/building-oauth-apps/authorizing-oauth-apps
- GitHub Gists: https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists
- ANPD agents/encarregado guide: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado
- ANPD security incident communication: https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis
