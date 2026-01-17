import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  convertToUsd,
  convertUsdToCurrency,
  getLatestFxRates,
  normalizeNiceHashAlgoKey,
  getNiceHashPayingSettings,
  toNumber,
} from "@/server/public";
import { computeElectricityUsdPerDay } from "@/server/profitability/math";

export const runtime = "nodejs";

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const currencyRequested = String(url.searchParams.get("currency") ?? "USD").toUpperCase();
  const regionKey = String(url.searchParams.get("region") ?? "GLOBAL").toUpperCase();
  const electricityUsdPerKwh = num(url.searchParams.get("electricity"), 0.10);

  const limit = Math.min(Math.max(num(url.searchParams.get("limit"), 200), 1), 500);

  const [fxRates, nicehash] = await Promise.all([
    getLatestFxRates(),
    getNiceHashPayingSettings(),
  ]);

  const currencyUsed =
    currencyRequested === "USD" || (fxRates && fxRates[currencyRequested])
      ? currencyRequested
      : "USD";

  const machines = await prisma.machine.findMany({
    include: {
      algorithm: true,
      vendorOfferings: {
        where: { inStock: true, regionKey },
        select: { price: true, currency: true },
      },
      profitabilitySnapshots: {
        orderBy: { computedAt: "desc" },
        take: 1,
        include: { bestCoin: true },
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const items = machines.map((m) => {
    const snap = m.profitabilitySnapshots[0] ?? null;

    // Snapshot revenue
    const revenueUsd = snap ? toNumber(snap.revenueUsdPerDay) : null;

    // Electricity derived from powerW (your requirement)
    const electricityUsdDay = computeElectricityUsdPerDay(m.powerW, electricityUsdPerKwh);

    const profitUsd =
      revenueUsd == null ? null : revenueUsd - electricityUsdDay;

    // Lowest offering in current region
    let lowestOfferUsd: number | null = null;
    for (const off of m.vendorOfferings) {
      const raw = toNumber(off.price);
      if (raw == null) continue;

      const usd = convertToUsd(raw, off.currency, fxRates);
      if (usd == null) continue;

      if (lowestOfferUsd == null || usd < lowestOfferUsd) lowestOfferUsd = usd;
    }

    const snapLowestUsd = snap ? toNumber(snap.lowestPriceUsd) : null;
    const priceUsdForRoi = snapLowestUsd ?? lowestOfferUsd;

    const roiDays =
      priceUsdForRoi != null && profitUsd != null && profitUsd > 0
        ? Math.ceil(priceUsdForRoi / profitUsd)
        : null;

    const algoKey = normalizeNiceHashAlgoKey(m.algorithm.key);
    const nicehashPaying = nicehash?.paying?.[algoKey] ?? null;

    const toCurr = (usd: number | null) => {
      if (usd == null) return null;
      if (currencyUsed === "USD") return usd;
      return convertUsdToCurrency(usd, currencyUsed, fxRates) ?? usd;
    };

    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      manufacturer: m.manufacturer,
      status: m.status,

      algorithm: {
        key: m.algorithm.key,
        name: m.algorithm.name,
        nicehashAlgo: algoKey,
        nicehashPayingSatPerUnitPerDay: nicehashPaying,
      },

      hashrate: m.hashrate,
      hashrateUnit: m.hashrateUnit,
      powerW: m.powerW,

      snapshot: snap
        ? {
            computedAt: snap.computedAt,
            bestCoin: snap.bestCoin ? { symbol: snap.bestCoin.symbol, name: snap.bestCoin.name } : null,
            revenueUsdPerDay: revenueUsd,
            // we derive electricity/profit for the user; snapshot electricity is baseline-only
            lowestPriceUsd: snapLowestUsd,
          }
        : null,

      derived: {
        electricityUsdPerKwh,
        electricityUsdPerDay: electricityUsdDay,
        revenuePerDay: toCurr(revenueUsd),
        profitPerDay: toCurr(profitUsd),
        lowestOfferPrice: toCurr(lowestOfferUsd),
        roiDays,
      },

      currencyUsed,
      regionKey,
    };
  });

  return NextResponse.json({
    ok: true,
    meta: {
      regionKey,
      electricityUsdPerKwh,
      currencyRequested,
      currencyUsed,
      fxAvailable: !!fxRates,
      nicehashPayingFetchedAt: nicehash?.fetchedAt ?? null,
      nicehashSource: nicehash?.source ?? null,
      limit,
    },
    items,
  });
}
