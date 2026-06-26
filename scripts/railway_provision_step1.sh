#!/usr/bin/env bash
set -euo pipefail

MODE="plan"
PROJECT_NAME="${RAILWAY_PROJECT_NAME:-gcv-condominio}"
PROJECT_ID="${RAILWAY_PROJECT_ID:-}"
GITHUB_REPO="${GITHUB_REPO:-communitypower/GCV-Condominio-v3.0}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
RAILWAY_BIN="${RAILWAY_BIN:-}"
WORKSPACE="${RAILWAY_WORKSPACE:-}"
DEFAULT_BETA_ALLOWED_EMAILS="${BETA_ALLOWED_EMAILS:-sindico@gcv.com.br,zelador@gcv.com.br,carlos.ramos@email.com,mariana.alves@email.com}"

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
  RAILWAY_PROJECT_ID=<optional-existing-project-id>
  GITHUB_REPO=communitypower/GCV-Condominio-v3.0
  GITHUB_BRANCH=main
  RAILWAY_BIN=<optional-railway-binary-path>

Optional:
  RAILWAY_WORKSPACE=<workspace-id-or-name>
  BETA_ALLOWED_EMAILS=<comma-separated-emails>
  APP_URL_DEV=https://<dev-domain>
  APP_URL_STAGING=https://<staging-domain>
  APP_URL_PRODUCTION=https://<production-domain>
  GOOGLE_CLIENT_ID=<client-id>
  GOOGLE_CLIENT_SECRET=<client-secret>
  MICROSOFT_CLIENT_ID=<client-id>
  MICROSOFT_CLIENT_SECRET=<client-secret>
  GEMINI_API_KEY=<optional-key>

Modes:
  --plan   Print the Railway commands without creating resources. Default.
  --apply  Execute the Railway commands. Requires `railway login` first.

This script creates Railway project/environments/services/domains and sets the
known non-production-safe variables. Configure pending APP_URL/OAuth variables
from docs/RAILWAY_OPERATIONS_RUNBOOK.md before expecting staging/production
OAuth validation to pass.
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

generate_secret() {
  node -e 'console.log(require("crypto").randomBytes(48).toString("base64"))'
}

env_value() {
  local key="$1"
  local env_name="$2"
  local upper_env
  local env_specific_key

  upper_env="$(printf '%s' "$env_name" | tr '[:lower:]' '[:upper:]')"
  env_specific_key="${key}_${upper_env}"
  printf '%s' "${!env_specific_key:-${!key:-}}"
}

set_var() {
  local service="$1"
  local environment="$2"
  local assignment="$3"
  local key="${assignment%%=*}"
  local display_assignment="$assignment"

  if [[ "$key" =~ (SECRET|KEY|DATABASE_URL) ]]; then
    display_assignment="$key=<redacted>"
  fi

  printf '+'
  printf ' %q' "${RAILWAY_CMD[@]}" variable set "$display_assignment" \
    --service "$service" \
    --environment "$environment" \
    --skip-deploys
  printf '\n'

  if [[ "$MODE" == "apply" ]]; then
    "${RAILWAY_CMD[@]}" variable set "$assignment" \
      --service "$service" \
      --environment "$environment" \
      --skip-deploys >/dev/null
  fi
}

set_optional_var() {
  local service="$1"
  local environment="$2"
  local key="$3"
  local value="$4"

  if [[ -n "$value" ]]; then
    set_var "$service" "$environment" "$key=$value"
  else
    echo "Pending variable for $environment/$service: $key"
  fi
}

workspace_arg=()
if [[ -n "$WORKSPACE" ]]; then
  workspace_arg=(--workspace "$WORKSPACE")
fi

echo "Railway Step 1 provisioning"
echo "Mode: $MODE"
echo "Project: $PROJECT_NAME"
if [[ -n "$PROJECT_ID" ]]; then
  echo "Project ID: $PROJECT_ID"
fi
echo "Repository: $GITHUB_REPO"
echo "Branch: $GITHUB_BRANCH"

if [[ "$MODE" == "apply" ]]; then
  require_login
else
  echo
  echo "Plan only. Re-run with --apply after authenticating with Railway."
fi

if [[ -n "$PROJECT_ID" ]]; then
  run "${RAILWAY_CMD[@]}" link --project "$PROJECT_ID" --environment dev --json
else
  run "${RAILWAY_CMD[@]}" init --name "$PROJECT_NAME" "${workspace_arg[@]}" --json
fi

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

  case "$env" in
    dev)
      node_env="${RAILWAY_NODE_ENV_DEV:-production}"
      ;;
    staging)
      node_env="staging"
      ;;
    production)
      node_env="production"
      ;;
  esac

  if [[ "$MODE" == "apply" ]]; then
    session_secret="$(generate_secret)"
  else
    session_secret="<generated-on-apply>"
  fi

  db_reference="\${{${db_service}.DATABASE_URL}}"
  beta_allowed="$(env_value BETA_ALLOWED_EMAILS "$env")"
  if [[ -z "$beta_allowed" ]]; then
    beta_allowed="$DEFAULT_BETA_ALLOWED_EMAILS"
  fi

  echo "Configuring known variables for $env/$app_service"
  set_var "$app_service" "$env" "NODE_ENV=$node_env"
  set_var "$app_service" "$env" "DATABASE_URL=$db_reference"
  set_var "$app_service" "$env" "SESSION_SECRET=$session_secret"
  set_var "$app_service" "$env" "BETA_ALLOWED_EMAILS=$beta_allowed"
  set_var "$app_service" "$env" "MICROSOFT_TENANT_ID=common"
  set_var "$app_service" "$env" "ENABLE_AI_ASSISTANT=false"
  set_var "$app_service" "$env" "ENABLE_GITHUB_INTEGRATION=false"
  set_var "$app_service" "$env" "ENABLE_DEMO_EXPORTS=false"
  set_var "$app_service" "$env" "GEMINI_MODEL=gemini-3.5-flash"

  set_optional_var "$app_service" "$env" "APP_URL" "$(env_value APP_URL "$env")"
  set_optional_var "$app_service" "$env" "GOOGLE_CLIENT_ID" "$(env_value GOOGLE_CLIENT_ID "$env")"
  set_optional_var "$app_service" "$env" "GOOGLE_CLIENT_SECRET" "$(env_value GOOGLE_CLIENT_SECRET "$env")"
  set_optional_var "$app_service" "$env" "MICROSOFT_CLIENT_ID" "$(env_value MICROSOFT_CLIENT_ID "$env")"
  set_optional_var "$app_service" "$env" "MICROSOFT_CLIENT_SECRET" "$(env_value MICROSOFT_CLIENT_SECRET "$env")"
  set_optional_var "$app_service" "$env" "GEMINI_API_KEY" "$(env_value GEMINI_API_KEY "$env")"
done

cat <<'NEXT_STEPS'

Next steps:
1. Configure pending variables in each Railway environment:
   docs/RAILWAY_OPERATIONS_RUNBOOK.md#3-required-variables
   Required before successful staging/production boot:
   - APP_URL
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - MICROSOFT_CLIENT_ID
   - MICROSOFT_CLIENT_SECRET
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
