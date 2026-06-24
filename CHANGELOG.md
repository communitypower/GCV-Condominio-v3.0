# Changelog

All notable changes to GCV Condominio are tracked here.

## 0.1.0-beta.1 - Pending

Status: release candidate pending external staging validation.

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

### Changed

- Railway is the official beta target for `dev`, `staging`, and `production`.
- GitHub/Gist and AI features are disabled by default and must be explicitly enabled.
- Docker Compose app startup now applies versioned migrations and seed before boot.
- Legacy GCP operation documents are marked historical.

### Known Limitations

- No real boleto, PIX, CNAB, bank reconciliation, or formal accounting ledger.
- No unrestricted AI processing of real tenant data before LGPD/privacy review.
- No production GitHub/Gist export for real tenant data.
- Production beta requires external Railway, OAuth, backup, restore, and security-scan validation before go-live.
