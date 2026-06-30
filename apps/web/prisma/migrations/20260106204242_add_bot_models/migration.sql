-- CreateTable
CREATE TABLE "BotWallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "lastBetTime" TIMESTAMP(3),
    "totalBets" INTEGER NOT NULL DEFAULT 0,
    "totalSpentFlr" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotBet" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "marketId" BIGINT NOT NULL,
    "betSide" TEXT NOT NULL,
    "amountFlr" DECIMAL(20,8) NOT NULL,
    "txHash" TEXT NOT NULL,
    "gasUsed" BIGINT,
    "strategy" TEXT NOT NULL,
    "poolRatioBefore" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotFunding" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountFlr" DECIMAL(20,8) NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotFunding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotError" (
    "id" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotWallet_address_key" ON "BotWallet"("address");

-- CreateIndex
CREATE INDEX "BotWallet_status_idx" ON "BotWallet"("status");

-- CreateIndex
CREATE INDEX "BotWallet_lastBetTime_idx" ON "BotWallet"("lastBetTime");

-- CreateIndex
CREATE INDEX "BotBet_walletId_idx" ON "BotBet"("walletId");

-- CreateIndex
CREATE INDEX "BotBet_marketId_idx" ON "BotBet"("marketId");

-- CreateIndex
CREATE INDEX "BotBet_createdAt_idx" ON "BotBet"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "BotFunding_walletId_idx" ON "BotFunding"("walletId");

-- CreateIndex
CREATE INDEX "BotFunding_createdAt_idx" ON "BotFunding"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "BotError_createdAt_idx" ON "BotError"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "BotError_errorType_idx" ON "BotError"("errorType");

-- AddForeignKey
ALTER TABLE "BotBet" ADD CONSTRAINT "BotBet_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BotWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotFunding" ADD CONSTRAINT "BotFunding_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BotWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
