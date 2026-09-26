-- AlterTable
ALTER TABLE "FundPayout" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows from the audit log's create entry where one exists
UPDATE "FundPayout" p
SET "createdAt" = a."timestamp"
FROM "AuditLog" a
WHERE a."entityType" = 'FundPayout' AND a."entityId" = p."id" AND a."action" = 'create';
