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

/**
 * Prisma Decimal-safe reader:
 * - Prisma Decimal has .toString()
 * - Some helpers already accept string/number, but keep this explicit and safe.
 */
function decToNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v?.toString === "function") {
    const n = Number(v.toString());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const currencyRequested = String(url.searchParams.get("currency") ?? "USD").toUpperCase();
  const regionKey = String(url.searchParams.get("region") ?? "GLOBAL").toUpperCase();

  // user "what-if" electricity (USD/kWh)
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
        select: {
          price: true,
          currency: true,
          shippingCost: true,
        },
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

  const toCurr = (usd: number | null) => {
    if (usd == null) return null;
    if (currencyUsed === "USD") return usd;
    return convertUsdToCurrency(usd, currencyUsed, fxRates) ?? usd;
  };

  const items = machines.map((m) => {
    const snap = m.profitabilitySnapshots[0] ?? null;

    // ✅ Snapshot numbers (now Decimal in Prisma)
    const snapRevenueUsd = snap ? decToNumber(snap.revenueUsdPerDay) : null;
    const snapElecUsdDay = snap ? decToNumber(snap.electricityUsdPerDay) : null;
    const snapNetProfitUsd = snap ? decToNumber(snap.profitUsdPerDay) : null;

    // Snapshot baseline electricity price (USD/kWh) used during compute
    const snapBaselineElecUsdPerKwh = snap ? decToNumber(snap.electricityUsdPerKwh) : null;

    /**
     * ✅ Enterprise “what-if electricity” consistent with decision engine:
     * - Snapshot profit is NET profit with snapshot's baseline electricity.
     * - If user supplies a different electricity rate, adjust profit by the delta cost:
     *     deltaUsdPerDay = (newElec - snapElecRate) * kWhPerDay
     *     newProfit = snapNetProfit - deltaUsdPerDay
     *
     * This preserves pool fee + hosting + everything else in the snapshot.
     */
    const kwhPerDay = (m.powerW / 1000) * 24;
    const deltaElecUsdDay =
      snapBaselineElecUsdPerKwh != null
        ? (electricityUsdPerKwh - snapBaselineElecUsdPerKwh) * kwhPerDay
        : null;

    const profitUsd =
      snapNetProfitUsd == null
        ? null
        : deltaElecUsdDay == null
        ? snapNetProfitUsd
        : snapNetProfitUsd - deltaElecUsdDay;

    // Also expose electricity/day derived from user's electricity (for UI clarity)
    const electricityUsdDayUser = computeElectricityUsdPerDay(m.powerW, electricityUsdPerKwh);

    // Lowest offering in current region (now Decimal)
    let lowestOfferUsd: number | null = null;
    let lowestShipUsd: number | null = null;

    for (const off of m.vendorOfferings) {
      const raw = decToNumber(off.price);
      if (raw == null) continue;

      const usd = convertToUsd(raw, off.currency, fxRates);
      if (usd == null) continue;

      if (lowestOfferUsd == null || usd < lowestOfferUsd) {
        lowestOfferUsd = usd;

        const shipRaw = decToNumber(off.shippingCost);
        if (shipRaw != null) {
          const shipUsd = convertToUsd(shipRaw, off.currency, fxRates);
          lowestShipUsd = shipUsd ?? null;
        } else {
          lowestShipUsd = null;
        }
      }
    }

    const snapLowestUsd = snap ? decToNumber(snap.lowestPriceUsd) : null;

    // Use snapshot price if present, otherwise marketplace lowest offer
    const priceUsdForRoi = snapLowestUsd ?? lowestOfferUsd;

    const roiDays =
      priceUsdForRoi != null && profitUsd != null && profitUsd > 0
        ? Math.ceil(priceUsdForRoi / profitUsd)
        : null;

    const algoKey = normalizeNiceHashAlgoKey(m.algorithm.key);
    const nicehashPaying = nicehash?.paying?.[algoKey] ?? null;

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
            bestCoin: snap.bestCoin
              ? { symbol: snap.bestCoin.symbol, name: snap.bestCoin.name }
              : null,

            // ✅ Now returned straight from snapshot (decision engine truth)
            revenueUsdPerDay: snapRevenueUsd,
            electricityUsdPerDay: snapElecUsdDay,
            netProfitUsdPerDay: snapNetProfitUsd,

            // baseline electricity used during compute
            baselineElectricityUsdPerKwh: snapBaselineElecUsdPerKwh,

            lowestPriceUsd: snapLowestUsd,
          }
        : null,

      derived: {
        // user's what-if input
        electricityUsdPerKwh,

        // derived electricity/day at user's rate (display only)
        electricityUsdPerDay: electricityUsdDayUser,

        // ✅ Profit is snapshot net profit adjusted for electricity delta (enterprise-consistent)
        revenuePerDay: toCurr(snapRevenueUsd),
        profitPerDay: toCurr(profitUsd),

        // marketplace
        lowestOfferPrice: toCurr(lowestOfferUsd),
        lowestOfferShipping: toCurr(lowestShipUsd),

        // ROI uses net profit (consistent with decision engine)
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
