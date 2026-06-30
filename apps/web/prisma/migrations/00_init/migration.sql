-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "TimeWindow" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "cadence" INTEGER NOT NULL DEFAULT 5,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "dailyCount" INTEGER NOT NULL DEFAULT 5,
    "bettingBuffer" INTEGER NOT NULL DEFAULT 600,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "settlerPaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "contractMarketId" INTEGER NOT NULL,
    "cityId" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "thresholdTemp" INTEGER NOT NULL,
    "resolveTime" TIMESTAMPTZ(6) NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "testRunId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "walletKeys" TEXT NOT NULL,
    "walletCount" INTEGER NOT NULL DEFAULT 3,
    "keysDisposed" BOOLEAN NOT NULL DEFAULT false,
    "marketsCreated" INTEGER NOT NULL,
    "marketsSettled" INTEGER NOT NULL,
    "fundingAmount" DECIMAL(10,2) NOT NULL,
    "fundingTxHash" TEXT,
    "recoveredAmount" DECIMAL(10,2) NOT NULL,
    "netCost" DECIMAL(10,2) NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "actualTemp" INTEGER,
    "totalVolume" DOUBLE PRECISION,
    "payoutVerified" BOOLEAN NOT NULL DEFAULT false,
    "results" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "cityId" TEXT,
    "customCityName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timeWindow" "TimeWindow",
    "comment" TEXT,
    "wallet" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "recentVoteCount" INTEGER NOT NULL DEFAULT 0,
    "lastVoteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "wallet" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "wallet" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT,
    "started_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "final_budget" DECIMAL(18,2),
    "profit_loss" DECIMAL(18,2),
    "creators_paid" INTEGER DEFAULT 0,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "creator_name" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT DEFAULT 'C2FLR',
    "status" TEXT DEFAULT 'pending',
    "tip_tx_hash" TEXT,
    "flare_txid" TEXT,
    "anchored_at" TIMESTAMPTZ(6),
    "bundle_url" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "xml_content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "City_isActive_idx" ON "City"("isActive");

-- CreateIndex
CREATE INDEX "Market_isTest_idx" ON "Market"("isTest");

-- CreateIndex
CREATE INDEX "Market_contractMarketId_idx" ON "Market"("contractMarketId");

-- CreateIndex
CREATE INDEX "Market_cityId_idx" ON "Market"("cityId");

-- CreateIndex
CREATE INDEX "Market_testRunId_idx" ON "Market"("testRunId");

-- CreateIndex
CREATE INDEX "Market_resolveTime_idx" ON "Market"("resolveTime");

-- CreateIndex
CREATE INDEX "Market_isTest_resolveTime_idx" ON "Market"("isTest", "resolveTime");

-- CreateIndex
CREATE INDEX "TestRun_suggestionId_idx" ON "TestRun"("suggestionId");

-- CreateIndex
CREATE INDEX "TestRun_status_idx" ON "TestRun"("status");

-- CreateIndex
CREATE INDEX "TestRun_startedAt_idx" ON "TestRun"("startedAt");

-- CreateIndex
CREATE INDEX "TestRun_status_startedAt_idx" ON "TestRun"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "Suggestion_status_voteCount_idx" ON "Suggestion"("status", "voteCount" DESC);

-- CreateIndex
CREATE INDEX "Suggestion_status_recentVoteCount_idx" ON "Suggestion"("status", "recentVoteCount" DESC);

-- CreateIndex
CREATE INDEX "Suggestion_createdAt_idx" ON "Suggestion"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Suggestion_wallet_status_idx" ON "Suggestion"("wallet", "status");

-- CreateIndex
CREATE INDEX "Suggestion_wallet_createdAt_idx" ON "Suggestion"("wallet", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Suggestion_cityId_idx" ON "Suggestion"("cityId");

-- CreateIndex
CREATE INDEX "Suggestion_customCityName_idx" ON "Suggestion"("customCityName");

-- CreateIndex
CREATE INDEX "Vote_suggestionId_idx" ON "Vote"("suggestionId");

-- CreateIndex
CREATE INDEX "Vote_wallet_createdAt_idx" ON "Vote"("wallet", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Vote_createdAt_idx" ON "Vote"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_wallet_suggestionId_key" ON "Vote"("wallet", "suggestionId");

-- CreateIndex
CREATE INDEX "AdminLog_wallet_idx" ON "AdminLog"("wallet");

-- CreateIndex
CREATE INDEX "AdminLog_createdAt_idx" ON "AdminLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminLog_action_idx" ON "AdminLog"("action");

-- CreateIndex
CREATE INDEX "AdminLog_wallet_createdAt_idx" ON "AdminLog"("wallet", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSession_wallet_idx" ON "AdminSession"("wallet");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_wallet_expiresAt_idx" ON "AdminSession"("wallet", "expiresAt");

-- CreateIndex
CREATE INDEX "idx_receipts_session" ON "receipts"("session_id");

-- CreateIndex
CREATE INDEX "idx_receipts_status" ON "receipts"("status");

-- CreateIndex
CREATE INDEX "idx_statements_session" ON "statements"("session_id");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

