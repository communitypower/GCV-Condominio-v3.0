# Restore Drill Log

This log records backup/restore drills performed before beta promotion.

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
