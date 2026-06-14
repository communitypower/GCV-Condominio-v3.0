# ADR-006: Database

Date: 2026-06-13

Status: Approved

## Context

Operational GCV data is currently stored in browser `localStorage`. Moving to a system of record requires a persistent backend database.

## Decision

1. Use **PostgreSQL** as the relational SQL system of record database.
2. Use **Prisma ORM** for database interaction, type-safety, and migrations.
3. Manage local migrations via Prisma's migrate CLI (`npx prisma migrate dev`).

## Rationale

- **Relational Integrity**: Essential for strict relationships (condominium -> building -> unit -> resident).
- **Prisma Developer Velocity**: Provides type-safe queries, easy schema declarations, and migration generation.
- **Widespread Compatibility**: PostgreSQL is readily hosted on GCP (Cloud SQL) or locally (Docker Compose).

## Alternatives Considered

- **MongoDB / Document Store**: Lack of strict relations and relational integrity makes financial/operational audit trails harder.
- **TypeORM / Sequelize**: Prisma is preferred for its declarative schema design and CLI-first migration flow.

## Consequences

Positive:
- Structured schema and migrations.
- Typecheck integration with TypeScript.

Tradeoffs:
- Prisma requires client regeneration step on schema changes.
