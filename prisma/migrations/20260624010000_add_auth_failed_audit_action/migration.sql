-- Track failed authentication attempts for known tenant users.

ALTER TYPE "AuditAction" ADD VALUE 'auth_failed';
