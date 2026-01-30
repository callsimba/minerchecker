/*
  Warnings:

  - Made the column `vendorId` on table `FeatureFlag` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "FeatureFlag" ALTER COLUMN "vendorId" SET NOT NULL;
