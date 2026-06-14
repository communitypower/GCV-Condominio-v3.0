# ADR-003: Tenant Hierarchy

Date: 2026-06-13

Status: Approved

## Context

GCV Condominio needs to support multiple condominiums, buildings, units, and residents while ensuring strict logical separation and data access control per account. Multiple owners or property management firms may utilize the system, requiring a multi-tenant scoping mechanism.

## Decision

We establish the following logical hierarchy:
```
Account (Tenant)
  └── Condominium
        └── Building / Block / Tower
              └── Unit
                    └── UnitRelationship (Owner, Tenant, Dependent)
                          └── Person
```
Every tenant-scoped table must reference `accountId` to allow rapid, robust tenant isolation filters at the query level.

## Rationale

- **Clear Scoping**: Groups properties under parent accounts representing property managers or syndics.
- **Historical Tracking**: `UnitRelationship` links a physical `Person` to a `Unit` over time, preventing loss of ownership history.
- **Query Efficiency**: Scoping tables by `accountId` allows query filters to prevent leaks at the database layer.

## Alternatives Considered

- **Flat Organization**: Relate everything directly to Condominium. Harder to scope when property managers handle multiple portfolios.
- **Shared Schemas (PostgreSQL schemas per tenant)**: Over-complex for MVP scale and increases migration management costs.

## Consequences

Positive:
- Robust multi-tenancy foundation.
- Auditable ownership history.

Tradeoffs:
- Slightly more tables and relations to manage during database queries.
