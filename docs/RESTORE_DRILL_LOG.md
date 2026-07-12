# Restore Drill Log

This log records backup/restore drills performed before beta promotion.

## 2026-07-11 Railway Production Logical Restore

Status: Passed, with automatic-backup gap still open

Scope:

- Source database: Railway production service `Postgres-yIw0`
- Recovery database: isolated Railway staging service `Postgres-Recovery`
- Application staging database `Postgres-X-b9`: not modified
- Backup format: PostgreSQL 18 custom-format logical dump
- Client: temporary `postgres:18-alpine` tool container
- Operator: Codex under the authenticated Railway session of the project owner
- Backup artifact: `backups/gcv-production-20260711-213351.dump` (gitignored local artifact)
- Artifact size: 72,456 bytes
- SHA-256: `7e33db51c3c01797128c8838ec1e5d93589ec79246e58fddee0dc8d5e435e458`

Core validation counts:

| Table | Row count |
| --- | ---: |
| `User` | 18 |
| `Condominium` | 2 |
| `Membership` | 21 |
| `AuditEvent` | 127 |
| `_prisma_migrations` | 10 |

Validation results:

- Exact row counts matched for all 24 application tables plus `_prisma_migrations`.
- `prisma migrate status` found 10 migrations and reported the recovery schema up to date.
- A repeated clean restore completed in 65 seconds through the Railway public proxy.
- The recovery service remained isolated and was never connected to an app service.
- Production was read only for the duration of `pg_dump`.

Recovery objectives:

- Observed database restore time: 65 seconds for the current beta dataset.
- Beta RTO target remains 8 hours and was met by this drill.
- Beta RPO target is 24 hours, but is **not yet guaranteed** because the current Railway plan does not expose native backups and no scheduled external backup has been configured.

Open controls:

- Move logical dumps to encrypted external storage instead of relying on the local workstation.
- Schedule at least daily dumps and verify retention and restore periodically.
- Rotate or remove local dump artifacts according to the approved retention policy.
- Repeat the drill after material schema growth and before onboarding unrestricted real data.

## 2026-06-24 Local Disposable Restore

Status: Passed

Scope:

- Source database: local Docker PostgreSQL `gcv_condominio`
- Recovery database: local Docker PostgreSQL `gcv_restore_verify`
- Backup format: custom `pg_dump`
- Restore tool: `pg_restore`
- Backup artifact: temporary local file under `backups/`, removed after validation

Validation counts:

| Table | Row count |
| --- | ---: |
| `User` | 16 |
| `Condominium` | 1 |
| `Membership` | 16 |
| `AuditEvent` | 15 |

Notes:

- The drill was executed through the local PostgreSQL Docker container because PostgreSQL client tools were not installed on the host.
- Prisma-style `?schema=public` URLs are not accepted directly by `pg_dump`; backup/restore helper scripts now remove the `schema` query parameter before calling PostgreSQL CLI tools.
- This local drill does not replace the required Railway staging restore drill before real beta data.
