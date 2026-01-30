// prisma/seed.ts
import "dotenv/config";
import {
  PrismaClient,
  FeatureFlagKey,
  FeatureFlagScope,
  TrustLevel,
  MachineStatus,
} from "@prisma/client";

import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// ✅ Import the single source of truth (relative path from prisma/)
import { ALGORITHM_CATALOG } from "../src/server/profitability/algorithmCatalog";

// Prisma v7 (adapter mode): PrismaClient must be constructed with an adapter.
function makePrismaClient() {
  const direct = process.env.DIRECT_URL;
  if (!direct) throw new Error("DIRECT_URL is not set in .env");

  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

  const adapter = new PrismaNeon({
    connectionString: direct,
  });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

const prisma = makePrismaClient();

async function main() {
  // Settings baseline
  await prisma.settings.upsert({
    where: { key: "site.defaultCurrency" },
    update: {},
    create: { key: "site.defaultCurrency", value: { code: "USD" } },
  });

  await prisma.settings.upsert({
    where: { key: "profitability.snapshotElectricityUsdPerKwh" },
    update: {},
    create: {
      key: "profitability.snapshotElectricityUsdPerKwh",
      value: { usdPerKwh: "0.10" },
    },
  });

  // ✅ Create a SYSTEM vendor row to anchor GLOBAL feature flags (required FK)
  const globalVendor = await prisma.vendor.upsert({
    where: { slug: "__global__" },
    update: {},
    create: {
      slug: "__global__",
      name: "SYSTEM: Global",
      websiteUrl: null,
      trustLevel: TrustLevel.UNKNOWN,
      isVerified: false,
      notes: "System placeholder vendor for GLOBAL feature flags. Do not edit.",
    },
  });

  // Global feature flags (OFF by default)
  await prisma.featureFlag.upsert({
    where: {
      scope_key_vendorId: {
        scope: FeatureFlagScope.GLOBAL,
        key: FeatureFlagKey.VENDOR_AUTO_PRICE_FETCH,
        vendorId: globalVendor.id,
      },
    },
    update: { enabled: false },
    create: {
      scope: FeatureFlagScope.GLOBAL,
      key: FeatureFlagKey.VENDOR_AUTO_PRICE_FETCH,
      enabled: false,
      vendorId: globalVendor.id,
    },
  });

  // Roles baseline for RBAC
  await prisma.role.upsert({
    where: { key: "admin" },
    update: {},
    create: { key: "admin", description: "Full access" },
  });

  await prisma.role.upsert({
    where: { key: "editor" },
    update: {},
    create: { key: "editor", description: "Can edit catalog but not manage users" },
  });

  await prisma.role.upsert({
    where: { key: "viewer" },
    update: {},
    create: { key: "viewer", description: "Read-only access" },
  });

  // ✅ Algorithms catalog (single source of truth)
  const algos = new Map<string, { id: string; key: string; name: string }>();

  for (const a of ALGORITHM_CATALOG) {
    const row = await prisma.algorithm.upsert({
      where: { key: a.key },
      update: {
        name: a.name,
        unit: a.unit,
        efficiencyUnit: a.efficiencyUnit,
      },
      create: {
        key: a.key,
        name: a.name,
        unit: a.unit,
        efficiencyUnit: a.efficiencyUnit,
      },
    });

    algos.set(row.key, row);
  }

  // Use seeded SHA-256 for BTC
  const sha256 = algos.get("sha256");
  if (!sha256) throw new Error("sha256 algorithm not seeded (unexpected).");

  const btc = await prisma.coin.upsert({
    where: { key: "btc" },
    update: {
      symbol: "BTC",
      name: "Bitcoin",
      algorithmId: sha256.id,
      blockTimeSec: 600,
    },
    create: {
      key: "btc",
      symbol: "BTC",
      name: "Bitcoin",
      algorithmId: sha256.id,
      blockTimeSec: 600,
    },
  });

  // Example vendor (manual-only)
  const vendor = await prisma.vendor.upsert({
    where: { slug: "example-vendor" },
    update: {},
    create: {
      slug: "example-vendor",
      name: "Example Vendor",
      websiteUrl: "https://example.com",
      trustLevel: TrustLevel.UNKNOWN,
      isVerified: false,
    },
  });

  // Example machine
  const machine = await prisma.machine.upsert({
    where: { slug: "exampleminer-x1" },
    update: {},
    create: {
      slug: "exampleminer-x1",
      name: "ExampleMiner X1",
      manufacturer: "ExampleMiner",
      algorithmId: sha256.id,
      hashrate: "100",
      hashrateUnit: "TH/s",
      powerW: 3200,
      efficiency: "32",
      efficiencyUnit: "J/TH",
      status: MachineStatus.AVAILABLE,
      releaseDate: new Date("2025-01-01"),
      canMineCoins: {
        create: [{ coinId: btc.id }],
      },
    },
  });

  // Example offering (manual price)
  await prisma.vendorOffering.upsert({
    where: {
      vendorId_machineId_currency_regionKey: {
        vendorId: vendor.id,
        machineId: machine.id,
        currency: "USD",
        regionKey: "GLOBAL",
      },
    },
    update: {
      price: "2999",
      productUrl: "https://example.com/product/exampleminer-x1",
      inStock: true,
    },
    create: {
      vendorId: vendor.id,
      machineId: machine.id,
      currency: "USD",
      regionKey: "GLOBAL",
      price: "2999",
      productUrl: "https://example.com/product/exampleminer-x1",
      inStock: true,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
