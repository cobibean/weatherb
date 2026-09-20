-- Hosted worker: one lease row per signer, a durable run log, and per-market submission tracking.
CREATE TABLE "WorkerLease" (
  "id" TEXT NOT NULL,
  "holder" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "WorkerLease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerRun" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(6),
  "summary" JSONB,
  "error" TEXT,
  CONSTRAINT "WorkerRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkerRun_kind_startedAt_idx" ON "WorkerRun"("kind", "startedAt" DESC);
CREATE INDEX "WorkerRun_status_idx" ON "WorkerRun"("status");

ALTER TABLE "Market"
  ADD COLUMN "settlementAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastSettlementAttemptAt" TIMESTAMPTZ(6),
  ADD COLUMN "lastSettlementError" TEXT,
  ADD COLUMN "settlementTxHash" TEXT,
  ADD COLUMN "settlementSubmittedAt" TIMESTAMPTZ(6),
  ADD COLUMN "settlementMessageId" TEXT;
