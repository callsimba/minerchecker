/*
  Warnings:

  - The `lowestPriceUsd` column on the `ProfitabilitySnapshot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `shippingCost` column on the `VendorOffering` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[machineId,computedAt]` on the table `ProfitabilitySnapshot` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `electricityUsdPerKwh` on the `ProfitabilitySnapshot` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `revenueUsdPerDay` on the `ProfitabilitySnapshot` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `electricityUsdPerDay` on the `ProfitabilitySnapshot` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `profitUsdPerDay` on the `ProfitabilitySnapshot` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `price` on the `VendorOffering` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "ProfitabilitySnapshot" ALTER COLUMN "computedAt" DROP DEFAULT,
DROP COLUMN "electricityUsdPerKwh",
ADD COLUMN     "electricityUsdPerKwh" DECIMAL(10,5) NOT NULL,
DROP COLUMN "revenueUsdPerDay",
ADD COLUMN     "revenueUsdPerDay" DECIMAL(18,6) NOT NULL,
DROP COLUMN "electricityUsdPerDay",
ADD COLUMN     "electricityUsdPerDay" DECIMAL(18,6) NOT NULL,
DROP COLUMN "profitUsdPerDay",
ADD COLUMN     "profitUsdPerDay" DECIMAL(18,6) NOT NULL,
DROP COLUMN "lowestPriceUsd",
ADD COLUMN     "lowestPriceUsd" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "VendorOffering" DROP COLUMN "price",
ADD COLUMN     "price" DECIMAL(18,2) NOT NULL,
DROP COLUMN "shippingCost",
ADD COLUMN     "shippingCost" DECIMAL(18,2);

-- CreateIndex
CREATE UNIQUE INDEX "ProfitabilitySnapshot_machineId_computedAt_key" ON "ProfitabilitySnapshot"("machineId", "computedAt");
