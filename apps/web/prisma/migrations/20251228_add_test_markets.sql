-- Epic 8: Add test market support and TestRun tracking
-- This migration adds the Market and TestRun models for automated city testing

-- Add TestStatus enum for test run status tracking
CREATE TYPE "TestStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- Create Market table for tracking both test and public markets
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

-- Create TestRun table for tracking automated test runs
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "encryptedKeys" TEXT NOT NULL,
    "walletCount" INTEGER NOT NULL DEFAULT 3,
    "keysDisposed" BOOLEAN NOT NULL DEFAULT false,
    "marketsCreated" INTEGER NOT NULL,
    "fundingAmount" DOUBLE PRECISION NOT NULL,
    "fundingTxHash" TEXT,
    "status" "TestStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "actualTemp" INTEGER,
    "totalVolume" DOUBLE PRECISION,
    "payoutVerified" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Market table
CREATE INDEX "Market_isTest_idx" ON "Market"("isTest");
CREATE INDEX "Market_contractMarketId_idx" ON "Market"("contractMarketId");
CREATE INDEX "Market_cityId_idx" ON "Market"("cityId");
CREATE INDEX "Market_testRunId_idx" ON "Market"("testRunId");
CREATE INDEX "Market_resolveTime_idx" ON "Market"("resolveTime");
CREATE INDEX "Market_isTest_resolveTime_idx" ON "Market"("isTest", "resolveTime");

-- Create indexes for TestRun table
CREATE INDEX "TestRun_suggestionId_idx" ON "TestRun"("suggestionId");
CREATE INDEX "TestRun_status_idx" ON "TestRun"("status");
CREATE INDEX "TestRun_startedAt_idx" ON "TestRun"("startedAt");
CREATE INDEX "TestRun_status_startedAt_idx" ON "TestRun"("status", "startedAt" DESC);

-- Add foreign key constraints
ALTER TABLE "Market" ADD CONSTRAINT "Market_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Market" ADD CONSTRAINT "Market_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
