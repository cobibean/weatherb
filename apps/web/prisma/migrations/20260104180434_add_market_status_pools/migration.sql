-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'CLOSED', 'RESOLVED', 'CANCELLED', 'NO_WINNERS');

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "noPool" TEXT NOT NULL DEFAULT '0',
ADD COLUMN     "sheetsLoggedAt" TIMESTAMPTZ(6),
ADD COLUMN     "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "yesPool" TEXT NOT NULL DEFAULT '0';
