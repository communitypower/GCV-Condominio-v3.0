#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"

normalize_pg_url() {
  node -e 'const url = new URL(process.argv[1]); url.searchParams.delete("schema"); console.log(url.toString());' "$1"
}

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="${BACKUP_DIR}/gcv-backup-${timestamp}.dump"

pg_dump "$(normalize_pg_url "$DATABASE_URL")" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file "$backup_file"

echo "$backup_file"
