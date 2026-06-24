# GCV Condominio - Incident Response & Operations Runbook

> Historical note: parts of this runbook reference the previous GCP Cloud Run plan. For the current Railway beta path, use `docs/RAILWAY_OPERATIONS_RUNBOOK.md` as the primary operational runbook.

This runbook defines standard operating procedures for handling production incidents, system failures, security anomalies, and compliance events.

---

## 1. Application Rollbacks

In the event of a critical regression, memory leak, or broken release in the application layer, follow these procedures to restore service.

### 1.1 GCP Cloud Run Revision Reversion
GCP Cloud Run maintains immutable revisions of container deployments. Reverting is instantaneous and does not require rebuilding a container.

1. **Identify the Last Known Good Revision**:
   ```bash
   gcloud run revisions list --service=gcv-app --region=us-central1
   ```
2. **Direct 100% of Traffic to the Good Revision**:
   ```bash
   gcloud run services update gcv-app \
     --region=us-central1 \
     --to-revisions=gcv-app-<GOOD_REVISION_ID>=100
   ```
3. **Verify Service Health**:
   Monitor the application log stream for 5xx errors:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gcv-app AND severity>=ERROR" --limit=20
   ```

### 1.2 Prisma Database Migration Rollbacks
Prisma database migrations are forward-only (`prisma migrate deploy`). When code is rolled back, database schemas might be ahead of the application code.
* **Backward-Compatible Code**: Ensure all migrations are additive (e.g. add nullable columns first, deploy code, then backfill, rather than renaming/deleting columns).
* **Hotfix Migration Rollback**:
  If a destructive migration was applied and must be reverted:
  1. Restore the database from the last backup (see [Section 2](#2-database-recovery-drills)).
  2. Mark the failed migration as rolled back in the Prisma migrations table so that subsequent deployments don't get blocked:
     ```bash
     npx prisma migrate resolve --rolled-back "20260613000000_failed_migration"
     ```
  3. Deploy the corrected code.

---

## 2. Database Recovery Drills

A regular database recovery drill must be performed quarterly. Follow these instructions to restore database services during data corruption or loss.

### 2.1 Point-in-Time Recovery (PITR) on GCP Cloud SQL
Cloud SQL automatically performs daily backups and records write-ahead logs (WAL), permitting restoration to any specific second within the retention period (default 7 days).

To restore the instance to a specific point in time:
```bash
gcloud sql instances restore-backup gcv-postgres-db \
  --restore-instance=gcv-postgres-db-recovery-target \
  --backup-id=<BACKUP_ID>
```
*Note: Restoring to a new target instance first is highly recommended to verify data integrity before promoting it to production.*

### 2.2 Local & Manual Restore Procedure (SQL Dump)
Using the backup files created by the `db_backup.ps1` script:

1. **Verify Backup Validity**:
   Ensure the backup file is not empty and contains valid SQL headers:
   ```powershell
   Get-Content -Path "C:\backups\db_backup_2026-06-13.sql" -Head 10
   ```
2. **Execute Restoration**:
   Using `pg_restore` (for custom/directory formats) or `psql` (for plain SQL files):
   ```bash
   # For plain SQL files:
   psql -h <DB_HOST> -p <DB_PORT> -U postgres -d gcv_database -f "C:\backups\db_backup_2026-06-13.sql"
   
   # For custom binary files (.bak / .dump):
   pg_restore -h <DB_HOST> -p <DB_PORT> -U postgres -d gcv_database -v "C:\backups\db_backup_2026-06-13.dump"
   ```
3. **Post-Restore Health Check**:
   Confirm that Core tables and relations are correctly populated:
   ```sql
   SELECT COUNT(*) FROM "User";
   SELECT COUNT(*) FROM "Condominium";
   ```

---

## 3. Emergency Kill Switches

To mitigate load spikes, external API failures, or active abuse vectors, the application supports configuration-based environment flags.

### 3.1 Disabling AI Assistant Integration
If the AI features consume excessive resources, exhibit hallucinations, or exceed API budgets:
1. In GCP Secret Manager or the environment variables configuration, locate:
   ```env
   AI_ASSISTANT_ENABLED=false
   ```
2. Redeploy/restart the service container.
3. The UI will gracefully show "AI Assistant is currently undergoing maintenance" for any resident chat attempts.

### 3.2 Activating Maintenance Mode
To block general users while allowing administrative debug access:
1. Set the maintenance flag:
   ```env
   MAINTENANCE_MODE=true
   ```
2. The middleware will intercept all incoming non-admin requests and return a `503 Service Unavailable` status with a clean user informational page.

---

## 4. Secrets Rotation

All credentials must be rotated annually, or immediately upon detection of exposure.

### 4.1 Rotation of Database Credentials (`DATABASE_URL`)
1. **Generate New Password**:
   ```bash
   gcloud sql users set-password postgres --instance=gcv-postgres-db --password=<NEW_STRONG_PASSWORD>
   ```
2. **Update GCP Secret Manager**:
   Create a new version of the secret containing the updated connection string:
   ```bash
   echo -n "postgresql://postgres:<NEW_STRONG_PASSWORD>@<DB_IP>:5432/gcv?sslmode=require" | \
     gcloud secrets versions add gcv-database-url --data-file=-
   ```
3. **Trigger Cloud Run Redeployment**:
   Cloud Run will fetch the latest secret version upon restart:
   ```bash
   gcloud run services update gcv-app --region=us-central1 --update-secrets=DATABASE_URL=gcv-database-url:latest
   ```

### 4.2 Rotation of Session Secret (`SESSION_SECRET`)
To invalidate all current active user sessions (e.g. in case of session hijacking leaks):
1. Create a new cryptographically secure random key.
2. Update the `SESSION_SECRET` secret value in Secret Manager.
3. Restart Cloud Run. All users will be prompted to log in again.

---

## 5. LGPD Compliance Protocol (Data Breaches & Rights)

As GCV Condominio processes personal data (PII) of residents, compliance with the Brazilian General Data Protection Law (LGPD - Lei Geral de Proteção de Dados) is mandatory.

### 5.1 Data Breach Notification (Article 48)
In the event of unauthorized access, leakage, or loss of personal data:
1. **Containment**: Immediately block the compromised system vectors (e.g., rotate credentials, shut down compromised instances).
2. **Assessment**: Identify affected datasets, number of compromised data subjects, and nature of PII exposed.
3. **Notification (72-Hour Window)**:
   Draft and submit the official notification to the National Data Protection Authority (ANPD) and notify the affected residents. The report must contain:
   * Description of the nature of the affected personal data.
   * Information about the data subjects involved.
   * Safety and mitigation measures utilized.
   * Risks and consequences of the incident.
   * Contact details of the DPO (Data Protection Officer).

### 5.2 Resident Rights Execution (Article 18)
Upon resident request for data confirmation, access, correction, or deletion:
1. **Anonymization/Erasure**:
   Run the anonymization query instead of deleting operational records to preserve financial audit history:
   ```sql
   UPDATE "User"
   SET "name" = 'ANONYMOUS_USER',
       "email" = CONCAT('anonymous_', id, '@gcv.internal'),
       "phone" = NULL,
       "cpf" = NULL
   WHERE "id" = '<USER_ID>';
   ```
2. **Data Export (Portability)**:
   Generate an JSON export of all records associated with the user's ID across tables (`User`, `Membership`, `MaintenanceTicket`, `Document`).
