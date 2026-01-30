-- AlterTable
ALTER TABLE "ProfitabilitySnapshot" ADD COLUMN     "bestCoinConfidence" INTEGER,
ADD COLUMN     "bestCoinReason" TEXT,
ADD COLUMN     "breakdown" JSONB;
