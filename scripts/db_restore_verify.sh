#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/db_restore_verify.sh <backup.dump>" >&2
  exit 1
fi

if [[ -z "${RECOVERY_DATABASE_URL:-}" ]]; then
  echo "RECOVERY_DATABASE_URL is required and must point to a disposable recovery database." >&2
  exit 1
fi

backup_file="$1"

normalize_pg_url() {
  node -e 'const url = new URL(process.argv[1]); url.searchParams.delete("schema"); console.log(url.toString());' "$1"
}

recovery_database_url="$(normalize_pg_url "$RECOVERY_DATABASE_URL")"

pg_restore \
  --dbname "$recovery_database_url" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "$backup_file"

psql "$recovery_database_url" <<'SQL'
SELECT 'User' AS table_name, COUNT(*) AS row_count FROM "User"
UNION ALL
SELECT 'Condominium' AS table_name, COUNT(*) AS row_count FROM "Condominium"
UNION ALL
SELECT 'Membership' AS table_name, COUNT(*) AS row_count FROM "Membership"
UNION ALL
SELECT 'AuditEvent' AS table_name, COUNT(*) AS row_count FROM "AuditEvent";
SQL
