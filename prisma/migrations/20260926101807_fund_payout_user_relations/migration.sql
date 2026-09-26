-- AddForeignKey
ALTER TABLE "FundPayout" ADD CONSTRAINT "FundPayout_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundPayout" ADD CONSTRAINT "FundPayout_vpDecisionById_fkey" FOREIGN KEY ("vpDecisionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundPayout" ADD CONSTRAINT "FundPayout_presDecisionById_fkey" FOREIGN KEY ("presDecisionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

