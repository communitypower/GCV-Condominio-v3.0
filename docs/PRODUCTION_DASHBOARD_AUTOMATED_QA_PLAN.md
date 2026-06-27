# GCV Production Dashboard Automated QA Plan

## Objective

Build and operate a production-safe automated QA suite for the GCV dashboard at:

```text
https://gcv-app-production-production.up.railway.app
```

The suite must validate functional behavior across the dashboard, roles, permissions, form validation, feature flags, and data lifecycle while only creating disposable records prefixed with `TEST_E2E_`.

## Multi-Agent Operating Model

| Agent | Responsibility | Output |
| --- | --- | --- |
| UI Explorer | Inventory dashboard screens, menu items, selectors, visual states, and accessibility gaps. | UI workflow matrix and selector backlog. |
| API Explorer | Inventory routes, auth/CSRF/RBAC rules, payloads, cleanup risks, and production-safe test paths. | API workflow matrix and risk list. |
| Test Implementer | Convert matrices into Playwright specs and helpers. | E2E specs, helpers, scripts. |
| Product Fixer | Fix defects uncovered by E2E, with small scoped changes. | Product patches and regression tests. |
| Release Verifier | Run production E2E, healthchecks, Railway status checks, cleanup, and final evidence. | Go/no-go report. |

## Production Safety Rules

- Use only `TEST_E2E_` prefixes for created visible records.
- Use future billing periods `2099-*` for generated charges.
- Run `/api/v1/testing/cleanup` before and after each production test run.
- Enable `/api/v1/testing/cleanup` only during execution with:
  - `ENABLE_E2E_TESTING=true`
  - `E2E_TEST_SECRET=<ephemeral-secret>`
- Disable E2E mode immediately after execution and redeploy.
- Never use real tenant data for destructive checks.
- Keep Microsoft and GitHub integrations in disabled-path validation unless real credentials are approved.

## Current Automated Coverage

| Area | Coverage |
| --- | --- |
| Auth/session | Password login, session restore surface, logout, unauthenticated API rejection. |
| OAuth entrypoints | Google redirect sanity and Microsoft controlled response. |
| Dashboard shell | Sidebar navigation across all major menu items. |
| Roles | Syndic workflow and resident dashboard state. |
| RBAC | Resident forbidden checks for admin/staff operations. |
| Validation | Invalid building, unit, equipment, charge, audit, and document payloads. |
| Operational | Building, unit, resident, equipment, plan, ticket, comment, document, audit workflows. |
| Maintenance | Equipment update, plan update/delete, ticket status/comment/assignment. |
| Finance | Individual charge creation, paid status, boleto/Pix fields, mass charge generation. |
| Documents | Metadata creation and simulated PDF download. |
| Feature flags | AI, GitHub, and demo export disabled-path checks. |
| Cleanup | Server-side cleanup for test records and 2099 billing periods. |

## Workflow Matrix To Keep Expanding

| Domain | Must Test | Status |
| --- | --- | --- |
| Shell/session | Login, logout, active menu, building selector, reload. | Automated baseline. |
| Dashboard | KPI visibility, shortcuts, no blank states. | Automated smoke. |
| Buildings/units | Create, list, update, invalid payload, resident forbidden. | Automated API. |
| Residents/staff | Create resident, resident login baseline, permission boundaries. | Automated partial. |
| Equipment/plans | Create, update, delete plan, validation, filters/counters. | Automated API; UI filters pending. |
| Tickets | Create, comment, assign, status transitions, resident visibility. | Automated API; detailed UI pending. |
| Audit logs | Create/list validation and staff-only access. | Automated API. |
| Billing | Individual charge, mass generation, mark paid, Pix/boleto fields. | Automated API; modal UI pending. |
| Payments/DRE | Render smoke and critical totals. | Pending API/UI expansion. |
| BIM/LCC/Purchases | Render smoke and main-panel state. | UI smoke only via navigation; deeper assertions pending. |
| Documents/notifications | Create/download and notification lifecycle. | Documents automated; notifications pending. |
| Integrations | Disabled AI/GitHub/demo paths return controlled 403. | Automated API. |

## Execution Procedure

1. Confirm `main` is clean and production is healthy:

```bash
curl -fsS https://gcv-app-production-production.up.railway.app/health
curl -fsS https://gcv-app-production-production.up.railway.app/livez
curl -fsS https://gcv-app-production-production.up.railway.app/readyz
```

2. Enable E2E mode with a new ephemeral secret.
3. Redeploy Railway production.
4. Run:

```bash
E2E_TEST_SECRET="<ephemeral-secret>" npm run test:e2e:prod
```

5. Confirm all tests pass.
6. Run cleanup one last time.
7. Disable E2E mode and redeploy.
8. Confirm `/api/v1/testing/cleanup` returns `404`.
9. Record deployment ID, healthchecks, and test summary.

## Product Fixes Implemented From This QA Pass

- Resident creation now stores the default local password as a bcrypt hash instead of plaintext, preserving password login behavior for created residents.
- Preventive plan deletion no longer requires an invalid request body on `DELETE`.
- Production E2E tests now verify the plan delete behavior and resident/admin permission boundaries.

## Backlog

- Add UI-level create/edit/delete tests for each modal once stable `data-testid` attributes are available.
- Add visual regression screenshots for dashboard, finance, maintenance board, BIM, and LCC panels.
- Add notification lifecycle API or UI test once endpoint support is confirmed.
- Add payments/DRE backend endpoints or UI-specific assertions.
- Add Google OAuth headed/manual-assisted production check after rotating the Google client secret.
