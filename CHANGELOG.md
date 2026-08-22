# Changelog

All notable changes to GCV Condominio are tracked here.

## 1.1.0-beta.1 - 2026-08-21

Status: release candidate; production promotion remains blocked until staging, OAuth, backup and go/no-go approval are complete.

### Added

- Railway-oriented runtime, readiness, and operations documentation.
- Production startup separated from local database push/seed workflows.
- Health endpoints: `/health`, `/livez`, and `/readyz`.
- Environment validation for production-like deployments.
- Server-side beta allowlist through `BETA_ALLOWED_EMAILS`.
- Auth audit trail for login, logout, known failed attempts, and OAuth linking.
- Server-side feature gates and audit logging for AI, GitHub/Gist, and demo export paths.
- CSRF Origin guard for unsafe cookie-authenticated requests in `staging` and `production`.
- Zod request validation for write routes.
- API smoke tests for auth, tenant isolation, documents, operations, and feature flags.
- Migration verification against a clean PostgreSQL database.
- GitHub Actions CI quality gate, API smoke job, Gitleaks, and CodeQL workflow.
- Nominative `system_admin` onboarding, scoped syndic/resident invitation lifecycle, and backend tenant authorization.
- Drag-and-drop document ingestion for PDF, DOCX, XLSX, CSV, JSON, TXT and technical images.
- Tenant-owned document versions, checksums, quarantine, fail-closed antivirus contract, extraction, chunking and signed downloads.
- Tenant/role/unit filtered RAG with document citations and human-reviewed maintenance-plan/service-order drafts.
- Document retention, legal hold and auditable physical-purge command.
- Secure password recovery with hashed one-use tokens and global session revocation.
- Non-destructive production smoke suite and expanded API/Playwright workflow coverage.

### Changed

- Railway is the official beta target for `dev`, `staging`, and `production`.
- GitHub/Gist and AI features are disabled by default and must be explicitly enabled.
- Docker Compose app startup now applies versioned migrations and seed before boot.
- Legacy GCP operation documents are marked historical.
- Microsoft OAuth is explicitly unavailable during the controlled beta.
- Unknown equipment dates remain null instead of being replaced with fabricated current dates.
- Disabled AI, document-ingestion and GitHub modules are hidden in the frontend and enforced in the backend.
- Prisma migration and dependency gates are reproducible from a clean PostgreSQL database with zero high audit findings.

### Known Limitations

- No real boleto, PIX, CNAB, bank reconciliation, or formal accounting ledger.
- No unrestricted AI processing of real tenant data before LGPD/privacy review.
- No production GitHub/Gist export for real tenant data.
- Real document ingestion requires persistent storage, an available antivirus endpoint and paired database/file backup.
- Password-recovery delivery requires an external e-mail webhook provider.
- The frontend bundle remains above the preferred 500 kB chunk threshold and should be split after beta stabilization.
- Production beta requires external Railway, OAuth, backup, restore, and security-scan validation before go-live.
