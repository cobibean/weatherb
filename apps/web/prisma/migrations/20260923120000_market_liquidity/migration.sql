-- Additive, disabled-by-default market maker state. Old sessions must authenticate again.
CREATE TYPE "LiquidityClassification" AS ENUM ('UNKNOWN', 'PUBLIC', 'TEST');
CREATE TYPE "LiquiditySeedStatus" AS ENUM ('QUEUED', 'SEEDING', 'PARTIAL', 'SEEDED', 'SKIPPED', 'ATTENTION');
CREATE TYPE "LiquidityClaimStatus" AS ENUM ('NONE', 'WAITING', 'CLAIMABLE', 'IN_FLIGHT', 'CLAIMED', 'NO_PAYOUT', 'ATTENTION');
CREATE TYPE "LiquidityOperation" AS ENUM ('YES_SEED', 'NO_SEED', 'CLAIM');
CREATE TYPE "LiquidityTransactionStatus" AS ENUM ('PREPARED', 'SUBMITTED', 'CONFIRMED', 'REVERTED', 'UNKNOWN', 'SUPERSEDED_EXTERNALLY');
CREATE TYPE "LiquiditySeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
ALTER TABLE "Market" ADD COLUMN "liquidityClassification" "LiquidityClassification" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Market" ADD COLUMN "liquidityUnknownSweeps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminSession" ADD COLUMN "authenticatedAt" TIMESTAMPTZ(6);
CREATE INDEX "Market_liquidityClassification_contractMarketId_idx" ON "Market"("liquidityClassification", "contractMarketId");

CREATE TABLE "LiquidityConfig" (
  "id" TEXT NOT NULL DEFAULT 'default', "deploymentKey" TEXT, "walletAddress" TEXT,
  "seedAmountWei" TEXT NOT NULL DEFAULT '2500000000000000000',
  "seedingEnabled" BOOLEAN NOT NULL DEFAULT false, "claimsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "firstEligibleMarketId" INTEGER, "activationBlockNumber" BIGINT, "activatedAt" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT, CONSTRAINT "LiquidityConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiquidityConfig_activation_complete" CHECK (
    ("firstEligibleMarketId" IS NULL AND "activationBlockNumber" IS NULL AND "activatedAt" IS NULL)
    OR ("firstEligibleMarketId" IS NOT NULL AND "activationBlockNumber" IS NOT NULL AND "activatedAt" IS NOT NULL)
  ),
  CONSTRAINT "LiquidityConfig_seed_amount" CHECK ("seedAmountWei" ~ '^[1-9][0-9]*$')
);
INSERT INTO "LiquidityConfig"("id") VALUES ('default');

CREATE TABLE "LiquidityCreationIntent" (
  "id" TEXT NOT NULL, "deploymentKey" TEXT NOT NULL, "intentKey" TEXT NOT NULL,
  "slot" BIGINT, "isTest" BOOLEAN NOT NULL, "source" TEXT NOT NULL,
  "creationTxHash" TEXT, "contractMarketId" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reconciledAt" TIMESTAMPTZ(6), "lastCheckedAt" TIMESTAMPTZ(6), "lastError" TEXT,
  CONSTRAINT "LiquidityCreationIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiquidityCreationIntent_source_slot" CHECK (("source" = 'scheduled' AND "slot" IS NOT NULL AND "intentKey" LIKE 'scheduled:%') OR ("source" = 'manual' AND "slot" IS NULL AND "intentKey" LIKE 'manual:%'))
);
CREATE UNIQUE INDEX "LiquidityCreationIntent_deploymentKey_intentKey_key" ON "LiquidityCreationIntent"("deploymentKey", "intentKey");
CREATE UNIQUE INDEX "LiquidityCreationIntent_deploymentKey_slot_key" ON "LiquidityCreationIntent"("deploymentKey", "slot");
CREATE INDEX "LiquidityCreationIntent_deploymentKey_reconciledAt_createdAt_idx" ON "LiquidityCreationIntent"("deploymentKey", "reconciledAt", "createdAt");
CREATE INDEX "LiquidityCreationIntent_deploymentKey_reconciledAt_lastCheckedAt_idx" ON "LiquidityCreationIntent"("deploymentKey", "reconciledAt", "lastCheckedAt");
ALTER TABLE "LiquidityCreationIntent" ADD CONSTRAINT "LiquidityCreationIntent_contractMarketId_fkey" FOREIGN KEY ("contractMarketId") REFERENCES "Market"("contractMarketId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LiquidityPosition" (
  "id" TEXT NOT NULL, "deploymentKey" TEXT NOT NULL, "walletAddress" TEXT NOT NULL,
  "contractMarketId" INTEGER NOT NULL, "seedStatus" "LiquiditySeedStatus" NOT NULL DEFAULT 'QUEUED',
  "claimStatus" "LiquidityClaimStatus" NOT NULL DEFAULT 'NONE', "waitReason" TEXT,
  "slotHeld" BOOLEAN NOT NULL DEFAULT false, "targetPerSideWei" TEXT,
  "configVersionAtReservation" INTEGER, "confirmedYesWei" TEXT NOT NULL DEFAULT '0',
  "confirmedNoWei" TEXT NOT NULL DEFAULT '0', "claimedAmountWei" TEXT NOT NULL DEFAULT '0', "claimableWei" TEXT,
  "gasSpentWei" TEXT NOT NULL DEFAULT '0', "lastCheckedBlock" BIGINT, "claimRecoveryCursor" BIGINT,
  "discoveredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstSeededAt" TIMESTAMPTZ(6), "claimedAt" TIMESTAMPTZ(6), "completedAt" TIMESTAMPTZ(6),
  "lastErrorCode" TEXT, "lastError" TEXT, "lastTransactionHash" TEXT,
  "lastTransactionStatus" "LiquidityTransactionStatus", "lastTransactionNonce" INTEGER,
  "lastTransactionOperation" "LiquidityOperation", "lastAttemptAt" TIMESTAMPTZ(6),
  "nextAttemptAt" TIMESTAMPTZ(6), CONSTRAINT "LiquidityPosition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiquidityPosition_deploymentKey_walletAddress_contractMarketId_key" ON "LiquidityPosition"("deploymentKey", "walletAddress", "contractMarketId");
CREATE INDEX "LiquidityPosition_deploymentKey_slotHeld_idx" ON "LiquidityPosition"("deploymentKey", "slotHeld");
CREATE INDEX "LiquidityPosition_deploymentKey_seedStatus_contractMarketId_idx" ON "LiquidityPosition"("deploymentKey", "seedStatus", "contractMarketId");
CREATE INDEX "LiquidityPosition_deploymentKey_claimStatus_contractMarketId_idx" ON "LiquidityPosition"("deploymentKey", "claimStatus", "contractMarketId");
ALTER TABLE "LiquidityPosition" ADD CONSTRAINT "LiquidityPosition_contractMarketId_fkey" FOREIGN KEY ("contractMarketId") REFERENCES "Market"("contractMarketId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LiquidityTransaction" (
  "id" TEXT NOT NULL, "positionId" TEXT NOT NULL, "operation" "LiquidityOperation" NOT NULL,
  "attempt" INTEGER NOT NULL, "deploymentKey" TEXT NOT NULL, "signerAddress" TEXT NOT NULL,
  "nonce" INTEGER NOT NULL, "toAddress" TEXT NOT NULL, "calldata" TEXT NOT NULL,
  "valueWei" TEXT NOT NULL, "gasLimitWei" TEXT NOT NULL, "maxFeePerGasWei" TEXT NOT NULL,
  "maxPriorityFeePerGasWei" TEXT NOT NULL, "signedTransaction" TEXT NOT NULL,
  "transactionHash" TEXT NOT NULL, "status" "LiquidityTransactionStatus" NOT NULL DEFAULT 'PREPARED',
  "preparedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstBroadcastAt" TIMESTAMPTZ(6), "lastBroadcastAt" TIMESTAMPTZ(6),
  "receiptBlockNumber" BIGINT, "receiptBlockHash" TEXT, "receiptStatus" TEXT,
  "confirmedAmountWei" TEXT, "gasSpentWei" TEXT, "errorCode" TEXT, "lastError" TEXT,
  "externalRecoveryHash" TEXT, "recoveryEvidence" TEXT,
  CONSTRAINT "LiquidityTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiquidityTransaction_transactionHash_key" ON "LiquidityTransaction"("transactionHash");
CREATE UNIQUE INDEX "LiquidityTransaction_deploymentKey_signerAddress_nonce_key" ON "LiquidityTransaction"("deploymentKey", "signerAddress", "nonce");
CREATE UNIQUE INDEX "LiquidityTransaction_positionId_operation_attempt_key" ON "LiquidityTransaction"("positionId", "operation", "attempt");
CREATE INDEX "LiquidityTransaction_deploymentKey_status_preparedAt_idx" ON "LiquidityTransaction"("deploymentKey", "status", "preparedAt");
ALTER TABLE "LiquidityTransaction" ADD CONSTRAINT "LiquidityTransaction_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "LiquidityPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LiquidityEvent" (
  "id" TEXT NOT NULL, "deploymentKey" TEXT NOT NULL, "walletAddress" TEXT NOT NULL,
  "positionId" TEXT, "contractMarketId" INTEGER, "transactionHash" TEXT,
  "code" TEXT NOT NULL, "severity" "LiquiditySeverity" NOT NULL, "message" TEXT NOT NULL,
  "details" JSONB, "incidentKey" TEXT, "firstSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "resolvedAt" TIMESTAMPTZ(6), "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiquidityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiquidityEvent_deploymentKey_createdAt_id_idx" ON "LiquidityEvent"("deploymentKey", "createdAt" DESC, "id");
CREATE INDEX "LiquidityEvent_deploymentKey_incidentKey_resolvedAt_idx" ON "LiquidityEvent"("deploymentKey", "incidentKey", "resolvedAt");
CREATE UNIQUE INDEX "LiquidityEvent_active_incident_key" ON "LiquidityEvent"("deploymentKey", "incidentKey") WHERE "incidentKey" IS NOT NULL AND "resolvedAt" IS NULL;
ALTER TABLE "LiquidityEvent" ADD CONSTRAINT "LiquidityEvent_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "LiquidityPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LiquidityWorkerState" (
  "id" TEXT NOT NULL, "deploymentKey" TEXT NOT NULL, "walletAddress" TEXT NOT NULL,
  "lastHeartbeatAt" TIMESTAMPTZ(6), "lastReconciledAt" TIMESTAMPTZ(6),
  "ready" BOOLEAN NOT NULL DEFAULT false, "balanceWei" TEXT,
  "balanceObservedAt" TIMESTAMPTZ(6), "balanceBlockNumber" BIGINT,
  "currentFailure" TEXT, "discoveryCursor" INTEGER, CONSTRAINT "LiquidityWorkerState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiquidityWorkerState_deploymentKey_walletAddress_key" ON "LiquidityWorkerState"("deploymentKey", "walletAddress");

ALTER TABLE "LiquidityConfig" ADD CONSTRAINT "LiquidityConfig_singleton" CHECK ("id" = 'default');
CREATE UNIQUE INDEX "LiquidityTransaction_one_unresolved_signer" ON "LiquidityTransaction"("deploymentKey", "signerAddress")
  WHERE "status" IN ('PREPARED', 'SUBMITTED', 'UNKNOWN');

CREATE FUNCTION liquidity_config_immutable_activation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."firstEligibleMarketId" IS NOT NULL AND (
    NEW."firstEligibleMarketId" IS DISTINCT FROM OLD."firstEligibleMarketId" OR
    NEW."activationBlockNumber" IS DISTINCT FROM OLD."activationBlockNumber" OR
    NEW."activatedAt" IS DISTINCT FROM OLD."activatedAt" OR
    NEW."walletAddress" IS DISTINCT FROM OLD."walletAddress" OR
    NEW."deploymentKey" IS DISTINCT FROM OLD."deploymentKey") THEN
    RAISE EXCEPTION 'liquidity activation and binding are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER liquidity_config_immutable_activation BEFORE UPDATE ON "LiquidityConfig"
  FOR EACH ROW EXECUTE FUNCTION liquidity_config_immutable_activation();
