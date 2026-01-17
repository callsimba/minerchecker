import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  fetchNiceHashPayingMap,
  normalizeAlgoKeyForNiceHash,
} from "@/server/profitability/nicehash";
import { getBtcUsdWithFallback } from "@/server/profitability/prices/btc-usd";
import {
  computeElectricityUsdPerDay,
  computeRevenueUsdPerDayFromNiceHash,
  parseSpeedToBase,
} from "@/server/profitability/math";
import { convertToUsd, getLatestFxRates, toNumber } from "@/server/public";

export const runtime = "nodejs";

const BASELINE_ELECTRICITY_USD_PER_KWH = Number(
  process.env.BASELINE_ELECTRICITY_USD_PER_KWH ?? "0.10"
);

/**
 * CRON auth rules:
 * - In production, require CRON_SECRET (recommended).
 * - Accept either:
 *    1) Header: x-cron-secret: <secret>
 *    2) Authorization: Bearer <secret>
 *    3) Query: ?secret=<secret>
 * - If CRON_SECRET is missing, fall back to checking Vercel cron UA.
 */
function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);

  // Local/dev: allow without secrets to simplify testing.
  if (process.env.NODE_ENV !== "production") return true;

  // If secret exists, require it
  if (secret && secret.trim().length) {
    const q = url.searchParams.get("secret");
    const auth = req.headers.get("authorization");
    const hdr = req.headers.get("x-cron-secret");

    if (hdr === secret) return true;
    if (q === secret) return true;
    if (auth === `Bearer ${secret}`) return true;

    return false;
  }

  // If no secret, at least ensure it looks like a Vercel cron call.
  const ua = req.headers.get("user-agent") ?? "";
  return ua.includes("vercel-cron/");
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const startedAt = new Date();

  // 1) Get BTC price (with provider fallback)
  let btcUsd: number;
  let btcSource: string;

  try {
    const r = await getBtcUsdWithFallback();
    btcUsd = r.usd;
    btcSource = r.source;

    // Store last good BTC price to Settings so we can fall back later if needed
    await prisma.settings.upsert({
      where: { key: "BTC_USD_LAST" },
      create: {
        key: "BTC_USD_LAST",
        value: {
          usd: btcUsd,
          source: btcSource,
          fetchedAt: startedAt.toISOString(),
        } as any,
      },
      update: {
        value: {
          usd: btcUsd,
          source: btcSource,
          fetchedAt: startedAt.toISOString(),
        } as any,
      },
    });
  } catch (e) {
    // Fall back to last stored
    const s = await prisma.settings.findUnique({ where: { key: "BTC_USD_LAST" } });
    const v: any = s?.value;
    const n = Number(v?.usd);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "BTC price unavailable (no live price + no stored fallback)",
        },
        { status: 500 }
      );
    }
    btcUsd = n;
    btcSource = String(v?.source ?? "Stored");
  }

  // 2) Fetch NiceHash paying map
  const paying = await fetchNiceHashPayingMap();

  // 3) Get FX rates for lowestPriceUsd/ROI calculation
  const fxRates = await getLatestFxRates();

  // 4) Get BTC coin id (bestCoin baseline)
  const btcCoin = await prisma.coin.findFirst({
    where: { OR: [{ key: "btc" }, { symbol: "BTC" }] },
    select: { id: true },
  });

  // 5) Load machines + offerings
  const machines = await prisma.machine.findMany({
    include: {
      algorithm: { select: { key: true } },
      vendorOfferings: {
        where: { inStock: true },
        select: { price: true, currency: true },
      },
    },
  });

  const baselineElec =
    Number.isFinite(BASELINE_ELECTRICITY_USD_PER_KWH) &&
    BASELINE_ELECTRICITY_USD_PER_KWH > 0
      ? BASELINE_ELECTRICITY_USD_PER_KWH
      : 0.1;

  const rows: any[] = [];
  let skipped = 0;

  for (const m of machines) {
    const algoKey = normalizeAlgoKeyForNiceHash(m.algorithm.key);
    const rate = paying[algoKey];
    if (!Number.isFinite(rate) || rate <= 0) {
      skipped++;
      continue; // no known paying rate
    }

    const speed = parseSpeedToBase(m.hashrate, m.hashrateUnit);
    if (!speed) {
      skipped++;
      continue;
    }

    const revenueUsdPerDay = computeRevenueUsdPerDayFromNiceHash({
      payingSatPerUnitPerDay: rate,
      speedBasePerSec: speed.value,
      btcUsd,
    });

    const electricityUsdPerDay = computeElectricityUsdPerDay(
      m.powerW,
      baselineElec
    );
    const profitUsdPerDay = revenueUsdPerDay - electricityUsdPerDay;

    // lowest offering price in USD (manual vendor offerings)
    let lowestPriceUsd: number | null = null;
    for (const off of m.vendorOfferings) {
      const raw = toNumber(off.price);
      if (raw == null) continue;
      const usd = convertToUsd(raw, off.currency, fxRates);
      if (usd == null) continue;
      if (lowestPriceUsd == null || usd < lowestPriceUsd) lowestPriceUsd = usd;
    }

    let roiDays: number | null = null;
    if (lowestPriceUsd != null && profitUsdPerDay > 0) {
      roiDays = Math.ceil(lowestPriceUsd / profitUsdPerDay);
    }

    rows.push({
      machineId: m.id,
      computedAt: startedAt,
      electricityUsdPerKwh: baselineElec.toFixed(4),
      bestCoinId: btcCoin?.id ?? null,
      revenueUsdPerDay: revenueUsdPerDay.toFixed(2),
      electricityUsdPerDay: electricityUsdPerDay.toFixed(2),
      profitUsdPerDay: profitUsdPerDay.toFixed(2),
      lowestPriceUsd:
        lowestPriceUsd == null ? null : lowestPriceUsd.toFixed(2),
      roiDays,
    });
  }

  if (rows.length > 0) {
    await prisma.profitabilitySnapshot.createMany({ data: rows });
  }

  const finishedAt = new Date();

  return NextResponse.json({
    ok: true,
    computedAt: startedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    machinesTotal: machines.length,
    snapshotsWritten: rows.length,
    skipped,
    btcUsd,
    btcSource,
    baselineElectricityUsdPerKwh: baselineElec,
  });
}
