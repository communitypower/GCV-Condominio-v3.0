# GCV Condomínio - Staging Deployment Walkthrough

> Historical note: this document records a previous GCP Cloud Run staging path. The current controlled-beta closure path uses Railway environments. See `docs/RAILWAY_OPERATIONS_RUNBOOK.md` and `docs/PRODUCT_CLOSURE_PLAN.md` before operating staging or production.

This document records the configuration details, troubleshooting steps, and deployment parameters established during the Gate 3 SaaS Staging deployment.

---

## 1. Environment Details

- **GCP Project ID**: `poder-da-comunidade`
- **GCP Project Number**: `822091468122`
- **Region**: `us-central1`
- **Environment**: `staging`
- **Staging Application URL**: [https://gcv-app-staging-jil5ryndmq-uc.a.run.app](https://gcv-app-staging-jil5ryndmq-uc.a.run.app)
- **Staging Database Instance**: `gcv-postgres-staging` (PostgreSQL 16)
- **GitHub Repository**: [communitypower/GCV-Condominio-v3.0](https://github.com/communitypower/GCV-Condominio-v3.0)

---

## 2. Infrastructure & IAM Settings (GCP)

### 2.1 Workload Identity Federation (WIF)
- **Pool Name**: `github-pool`
- **Provider Name**: `github-provider`
- **Audience (Identity Provider URI)**:
  `projects/822091468122/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- **Attribute Condition**: Restricts authentication to the v3.0 repository:
  `assertion.repository == 'communitypower/GCV-Condominio-v3.0'`

### 2.2 Service Account Permissions
- **CI/CD Deployer SA**: `gcv-deployer-sa@poder-da-comunidade.iam.gserviceaccount.com`
- **IAM Role Assignments**:
  - `roles/artifactregistry.admin`
  - `roles/run.admin`
  - `roles/storage.admin`
  - `roles/secretmanager.admin`
  - `roles/monitoring.alertPolicyEditor`
  - `roles/cloudsql.admin`
  - `roles/iam.securityAdmin`
  - `roles/iam.serviceAccountAdmin`
  - `roles/iam.serviceAccountUser` (Crucial for allowing deployer to act as the runtime service account).

---

## 3. Deployment Troubleshooting Log

### 3.1 Docker Multi-Stage Prisma Issue
- **Symptom**: Cloud Run container crashed on boot with: `Error: @prisma/client did not initialize yet. Please run "prisma generate"`.
- **Cause**: Multi-stage Docker build was doing `npm ci --omit=dev` in the runner stage without copying the `prisma/` folder containing the database schema, preventing the client from generating.
- **Fix**: Copied `prisma/` folder and added `RUN npx prisma generate` in the runner stage.

### 3.2 Cloud Run Impersonation Permission Denied
- **Symptom**: Deploy step failed with: `PERMISSION_DENIED: Permission 'iam.serviceaccounts.actAs' denied on service account gcv-cloudrun-sa-staging`.
- **Cause**: Deployer service account lacked the `roles/iam.serviceAccountUser` role at the project level.
- **Fix**: Granted `roles/iam.serviceAccountUser` role to the deployer service account.

### 3.3 Google IAM Credentials API Disabled
- **Symptom**: Docker authentication failed with: `IAM Service Account Credentials API has not been used in project before or it is disabled`.
- **Fix**: Enabled `iamcredentials.googleapis.com` API in the project.
