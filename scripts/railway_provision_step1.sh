#!/usr/bin/env bash
set -euo pipefail

MODE="plan"
PROJECT_NAME="${RAILWAY_PROJECT_NAME:-gcv-condominio}"
GITHUB_REPO="${GITHUB_REPO:-communitypower/GCV-Condominio-v3.0}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
RAILWAY_BIN="${RAILWAY_BIN:-}"
WORKSPACE="${RAILWAY_WORKSPACE:-}"

if [[ -n "$RAILWAY_BIN" ]]; then
  RAILWAY_CMD=("$RAILWAY_BIN")
elif command -v railway >/dev/null 2>&1; then
  RAILWAY_CMD=("railway")
else
  RAILWAY_CMD=("npx" "-y" "@railway/cli")
fi

usage() {
  cat <<'USAGE'
Usage: scripts/railway_provision_step1.sh [--plan|--apply]

Provision the Railway Step 1 foundation from docs/RAILWAY_OPERATIONS_RUNBOOK.md.

Defaults:
  RAILWAY_PROJECT_NAME=gcv-condominio
  GITHUB_REPO=communitypower/GCV-Condominio-v3.0
  GITHUB_BRANCH=main
  RAILWAY_BIN=<optional-railway-binary-path>

Optional:
  RAILWAY_WORKSPACE=<workspace-id-or-name>

Modes:
  --plan   Print the Railway commands without creating resources. Default.
  --apply  Execute the Railway commands. Requires `railway login` first.

This script creates Railway project/environments/services/domains only. It does
not set secrets or deploy production real data. Configure environment variables
from docs/RAILWAY_OPERATIONS_RUNBOOK.md before enabling real beta traffic.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan)
      MODE="plan"
      shift
      ;;
    --apply)
      MODE="apply"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

run() {
  printf '+'
  printf ' %q' "$@"
  printf '\n'
  if [[ "$MODE" == "apply" ]]; then
    "$@"
  fi
}

run_allow_fail() {
  printf '+'
  printf ' %q' "$@"
  printf ' || true\n'
  if [[ "$MODE" == "apply" ]]; then
    "$@" || true
  fi
}

require_login() {
  if ! "${RAILWAY_CMD[@]}" whoami >/dev/null 2>&1; then
    echo "Railway CLI is not authenticated." >&2
    echo "Run: ${RAILWAY_CMD[*]} login" >&2
    echo "Or for a remote shell: ${RAILWAY_CMD[*]} login --browserless" >&2
    exit 1
  fi
}

workspace_arg=()
if [[ -n "$WORKSPACE" ]]; then
  workspace_arg=(--workspace "$WORKSPACE")
fi

echo "Railway Step 1 provisioning"
echo "Mode: $MODE"
echo "Project: $PROJECT_NAME"
echo "Repository: $GITHUB_REPO"
echo "Branch: $GITHUB_BRANCH"

if [[ "$MODE" == "apply" ]]; then
  require_login
else
  echo
  echo "Plan only. Re-run with --apply after authenticating with Railway."
fi

run "${RAILWAY_CMD[@]}" init --name "$PROJECT_NAME" "${workspace_arg[@]}" --json

for env in dev staging production; do
  app_service="gcv-app-$env"
  db_service="gcv-postgres-$env"

  echo
  echo "Environment: $env"

  run_allow_fail "${RAILWAY_CMD[@]}" environment new "$env" --json
  run "${RAILWAY_CMD[@]}" environment link "$env" --json
  run "${RAILWAY_CMD[@]}" add --repo "$GITHUB_REPO" --branch "$GITHUB_BRANCH" --service "$app_service" --json
  run "${RAILWAY_CMD[@]}" add --database postgres --service "$db_service" --json
  run "${RAILWAY_CMD[@]}" domain --service "$app_service" --environment "$env" --json
done

cat <<'NEXT_STEPS'

Next steps:
1. Configure required variables in each Railway environment:
   docs/RAILWAY_OPERATIONS_RUNBOOK.md#3-required-variables
2. Confirm each app service uses:
   - Pre-deploy command: npm run db:migrate:deploy
   - Start command: npm run start
   - Healthcheck path: /readyz
3. Validate each environment domain:
   curl -fsS https://<environment-domain>/health
   curl -fsS https://<environment-domain>/livez
   curl -fsS https://<environment-domain>/readyz

Do not put real tenant data in production until the beta go/no-go checklist is complete.
NEXT_STEPS
