# ADR-005: Authorization

Date: 2026-06-13

Status: Approved

## Context

Different users (syndic, residents, doormen, managers) have varying access requirements. A tenant-safe RBAC and tenant scoping mechanism is required to prevent data leakage and unauthorized modifications.

## Decision

1. Enforce all permissions and scoping **server-side** on all API routes under `/api/v1`.
2. Use middleware to intercept requests and resolve the active User, Account (Tenant), and Condominium context.
3. Validate memberships and roles:
   - Platform roles (`admin`) have global/system-wide access.
   - Account roles (`syndic`, `manager`, `accountant`) are scoped to the Account.
   - Condominium-level memberships (e.g. `resident`) are scoped to their specific unit/condominium.
4. Implement a `tenantGuard` middleware to verify that any requested resource (via `accountId` or `condoId` params) matches the user's active membership context.

## Rationale

- **Defense in Depth**: Prevents unauthorized API access even if frontend elements are altered or bypassed.
- **Fail-Closed**: Requests are rejected by default unless explicit memberships and matching roles are validated.

## Alternatives Considered

- **Frontend-only scoping**: Unacceptable due to direct security risks.
- **Query-level policies (RLS)**: PostgreSQL RLS works but complicates queries and overrides testing flows in dev. Express middlewares provide cleaner programmatic control.

## Consequences

Positive:
- Robust API endpoints blocking cross-tenant data leaks.
- Clear separation of concerns between authentication and scoping.

Tradeoffs:
- Developer must remember to apply guards on all scoped endpoints.
