-- DropIndex
DROP INDEX "Setting_key_key";

-- CreateIndex
CREATE INDEX "Setting_key_idx" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_effectiveFrom_key" ON "Setting"("key", "effectiveFrom");

