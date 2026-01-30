-- CreateEnum
CREATE TYPE "MiningEventType" AS ENUM ('CONFERENCE', 'HARDWARE_LAUNCH', 'NETWORK_EVENT', 'WEBINAR', 'MEETUP', 'OTHER');

-- CreateEnum
CREATE TYPE "MiningEventStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "MiningEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MiningEventType" NOT NULL DEFAULT 'CONFERENCE',
    "status" "MiningEventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "timezone" TEXT,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "venue" TEXT,
    "city" TEXT,
    "country" TEXT,
    "regionKey" TEXT NOT NULL DEFAULT 'GLOBAL',
    "websiteUrl" TEXT,
    "ticketUrl" TEXT,
    "imageUrl" TEXT,
    "organizer" TEXT,
    "description" TEXT,
    "tags" TEXT[],
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiningEvent_slug_key" ON "MiningEvent"("slug");

-- CreateIndex
CREATE INDEX "MiningEvent_startAt_idx" ON "MiningEvent"("startAt");

-- CreateIndex
CREATE INDEX "MiningEvent_type_idx" ON "MiningEvent"("type");

-- CreateIndex
CREATE INDEX "MiningEvent_status_idx" ON "MiningEvent"("status");

-- CreateIndex
CREATE INDEX "MiningEvent_country_idx" ON "MiningEvent"("country");

-- CreateIndex
CREATE INDEX "MiningEvent_regionKey_idx" ON "MiningEvent"("regionKey");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "MachineCoin_machineId_idx" ON "MachineCoin"("machineId");

-- CreateIndex
CREATE INDEX "ProfitabilitySnapshot_bestCoinId_idx" ON "ProfitabilitySnapshot"("bestCoinId");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "Vendor_country_idx" ON "Vendor"("country");

-- CreateIndex
CREATE INDEX "VendorOffering_regionKey_idx" ON "VendorOffering"("regionKey");

-- CreateIndex
CREATE INDEX "VendorOffering_inStock_idx" ON "VendorOffering"("inStock");

-- CreateIndex
CREATE INDEX "VendorOffering_machineId_regionKey_inStock_idx" ON "VendorOffering"("machineId", "regionKey", "inStock");

-- CreateIndex
CREATE INDEX "WatchlistItem_userId_idx" ON "WatchlistItem"("userId");
