-- DropIndex
DROP INDEX "Payment_receiptNo_key";

-- CreateIndex
CREATE INDEX "Payment_receiptNo_idx" ON "Payment"("receiptNo");

