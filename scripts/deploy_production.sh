#!/usr/bin/env bash

# ==============================================================================
# GCV CONDOMINIO - PRODUCTION BOOTSTRAP AND DEPLOYMENT GUIDE
# ==============================================================================
# WARNING: DO NOT RUN THIS SCRIPT TO DEPLOY DIRECTLY FROM YOUR LOCAL MACHINE.
# Production releases are strictly CI/CD-controlled and require OIDC/WIF.
#
# This script serves as:
# 1. A template for initial GCP environment bootstrapping.
# 2. Reference commands for setting up Workload Identity Federation (WIF)
#    to authenticate GitHub Actions securely without using long-lived key files.
# ==============================================================================

set -euo pipefail

# Configuration variables
PROJECT_ID="gcv-condominio-prod"
REGION="us-central1"
GITHUB_REPO="communitypower/GCV-Condominio" # Owner/Repo name
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"

echo "=== GCV Condominio Infrastructure Bootstrapping ==="

# 1. Fallback Prevention check
# If running locally, print a warning and exit. We only allow bootstrapping commands to run.
if [ -z "${CI:-}" ]; then
  echo "Running in local environment."
  echo "Important: Production deployments must be executed through GitHub Actions."
  echo "This script is only intended for initial GCP OIDC/WIF setup."
  read -p "Do you want to print WIF setup commands? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
  fi
fi

echo "To authorize GitHub Actions using Workload Identity Federation, execute the following commands:"
echo "--------------------------------------------------------------------------------"

# Create a Workload Identity Pool
echo "gcloud identity workload-identity-pools create \"${POOL_NAME}\" \\"
echo "  --project=\"${PROJECT_ID}\" \\"
echo "  --location=\"global\" \\"
echo "  --display-name=\"GitHub Actions Pool\""
echo

# Get the full pool path
POOL_ID="projects/\$(gcloud projects list --filter=\"projectId:${PROJECT_ID}\" --format=\"value(projectNumber)\")/locations/global/workloadIdentityPools/${POOL_NAME}"

# Create the OIDC Provider within the Pool
echo "gcloud identity workload-identity-pools providers create-oidc \"${PROVIDER_NAME}\" \\"
echo "  --project=\"${PROJECT_ID}\" \\"
echo "  --location=\"global\" \\"
echo "  --workload-identity-pool=\"${POOL_NAME}\" \\"
echo "  --display-name=\"GitHub Actions Provider\" \\"
echo "  --attribute-mapping=\"google.subject=assertion.subject,attribute.actor=assertion.actor,attribute.repository=assertion.repository\" \\"
echo "  --issuer-uri=\"https://token.actions.githubusercontent.com\""
echo

# Service Account for Deployment (CI/CD SA)
DEPLOY_SA="gcv-deployer-sa"
echo "gcloud iam service-accounts create \"${DEPLOY_SA}\" \\"
echo "  --project=\"${PROJECT_ID}\" \\"
echo "  --display-name=\"GCV CI/CD Deployer Service Account\""
echo

# Bind the GitHub Repository access to the Deployer SA
echo "gcloud iam service-accounts add-iam-policy-binding \"${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com\" \\"
echo "  --project=\"${PROJECT_ID}\" \\"
echo "  --role=\"roles/iam.workloadIdentityUser\" \\"
echo "  --member=\"principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${GITHUB_REPO}\""
echo

# Grant required permissions to the Deployer SA to manage resources in the project
echo "for role in roles/artifactregistry.admin roles/run.admin roles/storage.admin roles/secretmanager.admin roles/monitoring.alertPolicyEditor; do"
echo "  gcloud projects add-iam-policy-binding \"${PROJECT_ID}\" \\"
echo "    --member=\"serviceAccount:${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com\" \\"
echo "    --role=\"\$role\""
echo "done"
echo

echo "--------------------------------------------------------------------------------"
echo "After configuring WIF, add the following secrets/variables to your GitHub Repository settings:"
echo "  - GCP_PROJECT_ID: ${PROJECT_ID}"
echo "  - GCP_WORKLOAD_IDENTITY_PROVIDER: projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"
echo "  - GCP_SERVICE_ACCOUNT: ${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "--------------------------------------------------------------------------------"
