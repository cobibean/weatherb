-- A restart database represents one deployment. Refuse duplicates rather than deleting history.
CREATE UNIQUE INDEX "Market_contractMarketId_key" ON "Market"("contractMarketId");
ALTER TABLE "SystemConfig" ADD COLUMN "deploymentKey" TEXT;
