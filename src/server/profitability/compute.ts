// src/server/profitability/compute.ts
import { prisma } from "@/lib/db";
import {
  fetchNiceHashPayingMap,
  normalizeAlgoKeyForNiceHash,
} from "@/server/profitability/nicehash";
import { ALGORITHM_CATALOG } from "@/server/profitability/algorithmCatalog";
import { getBtcUsdWithFallback } from "@/server/profitability/prices/btc-usd";
import {
  computeRevenueUsdPerDayFromNiceHash,
  parseSpeedToBase,
} from "@/server/profitability/math";
import { convertToUsd, getLatestFxRates, toNumber } from "@/server/public";

// ✅ use your existing advanced costs.ts
import {
  computeCostBreakdown,
  computePaybackDate,
} from "@/server/profitability/costs";

// ✅ best-coin (hashrate.no)
import { fetchHashrateNoRevenueUsdPerDayPerBase } from "@/server/profitability/hashrateNo";

const BASELINE_ELECTRICITY_USD_PER_KWH = Number(
  process.env.BASELINE_ELECTRICITY_USD_PER_KWH ?? "0.10"
);

// Concurrency limit for hashrate.no calls (enterprise-friendly)
const HASHRATENO_CONCURRENCY = Math.max(
  1,
  Math.min(20, Number(process.env.HASHRATENO_CONCURRENCY ?? "8"))
);

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// ✅ PATCH: allow decimal percentages (e.g., 1.5%) without truncating
function clampNum(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// ✅ PATCH: keep up to 3 decimals for pool fee percent
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function startOfHourUTC(d = new Date()) {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      0,
      0,
      0
    )
  );
}

/**
 * Enterprise-safe Decimal writers:
 * - Prisma Decimal columns accept numeric strings reliably.
 * - Keep precision aligned with schema:
 *   electricityUsdPerKwh: Decimal(10,5)
 *   revenue/electricity/profit per day: Decimal(18,6)
 *   prices: Decimal(18,2)
 */
function dec5(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(5);
}
function dec6(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(6);
}
function dec2(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(2);
}

// DB Algorithm.key -> NiceHash normalized key
const NICEHASH_KEY_BY_DB_KEY = new Map<string, string>();
for (const row of ALGORITHM_CATALOG) {
  const dbKey = String(row.key).trim().toLowerCase();
  if (!dbKey) continue;

  const nh = row.niceHashKey
    ? normalizeAlgoKeyForNiceHash(row.niceHashKey)
    : normalizeAlgoKeyForNiceHash(row.key);

  NICEHASH_KEY_BY_DB_KEY.set(dbKey, nh);
}

// DB Algorithm.key -> fallback revenue rate + unit (optional)
const FALLBACK_USD_PER_UNIT_DAY_BY_DB_KEY = new Map<string, number>();
const FALLBACK_UNIT_BY_DB_KEY = new Map<string, string>();

for (const row of ALGORITHM_CATALOG) {
  const dbKey = String(row.key).trim().toLowerCase();
  if (!dbKey) continue;

  if (
    Number.isFinite(row.fallbackRevenueUsdPerUnitPerDay as number) &&
    (row.fallbackRevenueUsdPerUnitPerDay as number) > 0
  ) {
    FALLBACK_USD_PER_UNIT_DAY_BY_DB_KEY.set(
      dbKey,
      Number(row.fallbackRevenueUsdPerUnitPerDay)
    );
    FALLBACK_UNIT_BY_DB_KEY.set(dbKey, String(row.unit || "").trim());
  }
}

function resolveNiceHashAlgoKey(dbAlgorithmKey: string) {
  const dbKey = String(dbAlgorithmKey ?? "").trim().toLowerCase();
  if (!dbKey) return "";
  return (
    NICEHASH_KEY_BY_DB_KEY.get(dbKey) ??
    normalizeAlgoKeyForNiceHash(dbAlgorithmKey)
  );
}

function normUnit(u: string) {
  return String(u ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\/SEC$/, "/S")
    .replace(/\/SECOND$/, "/S");
}

// base is H/s (or Sol/s)
const UNIT_MULT: Record<string, number> = {
  "H/S": 1,
  "KH/S": 1e3,
  "MH/S": 1e6,
  "GH/S": 1e9,
  "TH/S": 1e12,
  "PH/S": 1e15,
  "SOL/S": 1,
  "KSOL/S": 1e3,
  "MSOL/S": 1e6,
};

function baseToUnit(basePerSec: number, targetUnit: string) {
  const k = normUnit(targetUnit);
  const mult = UNIT_MULT[k];
  if (!Number.isFinite(mult) || mult <= 0) return null;
  return basePerSec / mult;
}

async function getNiceHashPayingWithFallback(computedAt: Date) {
  // Try live NiceHash first; store it for fallback
  try {
    const paying = await fetchNiceHashPayingMap();
    await prisma.settings.upsert({
      where: { key: "NICEHASH_PAYING_MAP" },
      create: {
        key: "NICEHASH_PAYING_MAP",
        value: {
          fetchedAt: computedAt.toISOString(),
          source: "nicehash",
          paying,
        } as any,
      },
      update: {
        value: {
          fetchedAt: computedAt.toISOString(),
          source: "nicehash",
          paying,
        } as any,
      },
    });
    return paying;
  } catch {
    // fallback: stored paying map
    const row = await prisma.settings.findUnique({
      where: { key: "NICEHASH_PAYING_MAP" },
    });
    const v: any = row?.value;
    const payingRaw = v?.paying;
    if (!payingRaw || typeof payingRaw !== "object") return {};

    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(payingRaw)) {
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) out[String(k).toUpperCase()] = n;
    }
    return out;
  }
}

function confidenceFromTop2(best: number, second: number | null) {
  if (!Number.isFinite(best) || best <= 0) return 0;
  if (second == null || !Number.isFinite(second) || second <= 0) return 55;

  const margin = (best - second) / best; // 0..1
  if (margin >= 0.30) return 90;
  if (margin >= 0.15) return 75;
  if (margin >= 0.07) return 60;
  if (margin >= 0.03) return 45;
  return 30;
}

/**
 * Simple concurrency limiter (no dependency).
 */
function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active--;
    const fn = queue.shift();
    if (fn) fn();
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

/**
 * Enterprise-grade hashrate.no resolver:
 * - Prefetch all candidate coins once per run
 * - Concurrency-limited
 * - Shared promise cache prevents duplicate concurrent calls
 */
async function prefetchHashrateNoPerBaseByCoinId(
  coins: Array<{ id: string; key: string; symbol: string }>
) {
  const limit = createLimiter(HASHRATENO_CONCURRENCY);

  // cache by identifier (key/symbol) and by coinId
  const idToPromise = new Map<string, Promise<number | null>>();
  const coinIdToPerBase = new Map<string, number | null>();

  const fetchByIdentifier = (identifier: string) => {
    // ✅ PATCH: normalize identifier to avoid duplicate cache entries (BTC vs btc)
    const k = String(identifier ?? "").trim().toLowerCase();
    if (!k) return Promise.resolve<number | null>(null);

    const cached = idToPromise.get(k);
    if (cached) return cached;

    const p = limit(async () => {
      const est = await fetchHashrateNoRevenueUsdPerDayPerBase(k);
      const perBase = est?.revenueUsdPerDayPerBase ?? null;
      if (!perBase || !Number.isFinite(perBase) || perBase <= 0) return null;
      return perBase;
    });

    idToPromise.set(k, p);
    return p;
  };

  await Promise.all(
    coins.map(async (c) => {
      // Try coin.key first (usually slug), then symbol fallback
      const keyTry = String(c.key ?? "").trim();
      const symTry = String(c.symbol ?? "").trim();

      const a = keyTry ? await fetchByIdentifier(keyTry) : null;
      if (a != null) {
        coinIdToPerBase.set(c.id, a);
        return;
      }

      const b = symTry ? await fetchByIdentifier(symTry) : null;
      if (b != null) {
        coinIdToPerBase.set(c.id, b);
        return;
      }

      coinIdToPerBase.set(c.id, null);
    })
  );

  return coinIdToPerBase;
}

export async function computeProfitabilitySnapshots(opts: any = {}) {
  const runStartedAt: Date = opts.computedAt ?? new Date();

  // ✅ Enterprise strategy: bucket timestamp (hourly UTC)
  const computedBucket = startOfHourUTC(runStartedAt);

  const elecFromOpts = toFiniteNumber(opts.electricityUsdPerKwh);
  const baselineElec =
    elecFromOpts != null
      ? elecFromOpts
      : Number.isFinite(BASELINE_ELECTRICITY_USD_PER_KWH) &&
        BASELINE_ELECTRICITY_USD_PER_KWH > 0
      ? BASELINE_ELECTRICITY_USD_PER_KWH
      : 0.10;

  // ✅ PATCH: keep pool fee as decimal percent (0..100), up to 3 decimals
  const poolFeePct = clampNum(round3(toFiniteNumber(opts.poolFeePct) ?? 0), 0, 100);

  const hostingUsdPerDay = Math.max(
    0,
    toFiniteNumber(opts.hostingUsdPerDay) ?? 0
  );

  const btc = await (async () => {
    try {
      const r = await getBtcUsdWithFallback();
      await prisma.settings.upsert({
        where: { key: "BTC_USD_LAST" },
        create: {
          key: "BTC_USD_LAST",
          value: {
            usd: r.usd,
            source: r.source,
            fetchedAt: runStartedAt.toISOString(),
          } as any,
        },
        update: {
          value: {
            usd: r.usd,
            source: r.source,
            fetchedAt: runStartedAt.toISOString(),
          } as any,
        },
      });
      return { usd: r.usd, source: r.source };
    } catch {
      const s = await prisma.settings.findUnique({
        where: { key: "BTC_USD_LAST" },
      });
      const v: any = s?.value;
      const n = Number(v?.usd);
      if (!Number.isFinite(n) || n <= 0)
        throw new Error("BTC price unavailable");
      return { usd: n, source: String(v?.source ?? "Stored") };
    }
  })();

  const paying = await getNiceHashPayingWithFallback(runStartedAt);
  const fxRates = await getLatestFxRates();

  const btcCoin = await prisma.coin.findFirst({
    where: { OR: [{ key: "btc" }, { symbol: "BTC" }] },
    select: { id: true },
  });

  const where = opts.machineIds?.length
    ? { id: { in: opts.machineIds } }
    : undefined;

  // preload coins
  const allCoins = await prisma.coin.findMany({
    select: { id: true, key: true, symbol: true, name: true, algorithmId: true },
  });
  const coinsByAlgo = new Map<string, typeof allCoins>();
  for (const c of allCoins) {
    if (!coinsByAlgo.has(c.algorithmId)) coinsByAlgo.set(c.algorithmId, []);
    coinsByAlgo.get(c.algorithmId)!.push(c);
  }

  const machines = await prisma.machine.findMany({
    where,
    include: {
      algorithm: { select: { key: true, name: true } },
      vendorOfferings: {
        where: { inStock: true },
        select: { price: true, currency: true, shippingCost: true },
      },
      canMineCoins: {
        select: {
          coin: {
            select: { id: true, key: true, symbol: true, name: true, algorithmId: true },
          },
        },
      },
    },
  });

  // =========================
  // ✅ Prefetch Hashrate.no for all candidate coins (once per run)
  // =========================
  const uniqueCandidateCoins = new Map<
    string,
    { id: string; key: string; symbol: string }
  >();

  for (const m of machines) {
    const machineCoins = (m.canMineCoins ?? []).map((x) => x.coin);
    const candidates =
      machineCoins.length > 0 ? machineCoins : coinsByAlgo.get(m.algorithmId) ?? [];
    const candidateList = candidates.slice(0, 25);

    for (const c of candidateList) {
      if (!uniqueCandidateCoins.has(c.id)) {
        uniqueCandidateCoins.set(c.id, { id: c.id, key: c.key, symbol: c.symbol });
      }
    }
  }

  const perBaseByCoinId = await prefetchHashrateNoPerBaseByCoinId(
    Array.from(uniqueCandidateCoins.values())
  );

  const rows: any[] = [];
  let skipped = 0;

  for (const m of machines) {
    const speed = parseSpeedToBase(m.hashrate, m.hashrateUnit);
    if (!speed) {
      skipped++;
      continue;
    }

    // determine lowest hardware price & optional shipping from offerings
    let lowestPriceUsd: number | null = null;
    let lowestShippingUsd: number | null = null;

    for (const off of m.vendorOfferings) {
      const raw = toNumber(off.price);
      if (raw != null) {
        const usd = convertToUsd(raw, off.currency, fxRates);
        if (usd != null) {
          if (lowestPriceUsd == null || usd < lowestPriceUsd) {
            lowestPriceUsd = usd;

            // tie shipping to the lowest-price offering (optional)
            const shipRaw = toNumber(off.shippingCost);
            if (shipRaw != null) {
              const shipUsd = convertToUsd(shipRaw, off.currency, fxRates);
              lowestShippingUsd = shipUsd ?? null;
            } else {
              lowestShippingUsd = null;
            }
          }
        }
      }
    }

    // candidates: machine coins if available, else all algo coins
    const machineCoins = (m.canMineCoins ?? []).map((x) => x.coin);
    const candidates =
      machineCoins.length > 0 ? machineCoins : coinsByAlgo.get(m.algorithmId) ?? [];
    const candidateList = candidates.slice(0, 25);

    let revenueUsdPerDay: number | null = null;
    let bestCoinId: string | null = null;
    let bestCoinConfidence: number | null = null;
    let bestCoinReason: string | null = null;
    let revenueSource: "hashrate.no" | "nicehash" | "catalog-fallback" | "none" =
      "none";

    // =========================
    // Option 2: true multi-coin best coin via Hashrate.no (prefetched)
    // =========================
    let bestPerBase: number | null = null;
    let secondPerBase: number | null = null;
    let bestCoinObj: (typeof candidateList)[number] | null = null;

    for (const c of candidateList) {
      const perBase = perBaseByCoinId.get(c.id) ?? null;
      if (!perBase || !Number.isFinite(perBase) || perBase <= 0) continue;

      if (bestPerBase == null || perBase > bestPerBase) {
        secondPerBase = bestPerBase;
        bestPerBase = perBase;
        bestCoinObj = c;
      } else if (secondPerBase == null || perBase > secondPerBase) {
        secondPerBase = perBase;
      }
    }

    if (bestPerBase != null && bestCoinObj) {
      revenueUsdPerDay = bestPerBase * speed.value;
      bestCoinId = bestCoinObj.id;

      const conf = confidenceFromTop2(bestPerBase, secondPerBase);
      bestCoinConfidence = clampInt(conf, 0, 100);

      const marginPct =
        secondPerBase != null && secondPerBase > 0
          ? Math.max(0, ((bestPerBase - secondPerBase) / bestPerBase) * 100)
          : null;

      bestCoinReason =
        marginPct != null
          ? `Hashrate.no best-of-${candidateList.length}: ${bestCoinObj.symbol} wins by ~${marginPct.toFixed(
              1
            )}% over #2`
          : `Hashrate.no best-of-${candidateList.length}: ${bestCoinObj.symbol} selected (no #2 found)`;

      revenueSource = "hashrate.no";
    }

    // =========================
    // Fallback 1: NiceHash (BTC payout)
    // =========================
    if (revenueUsdPerDay == null) {
      const nhAlgoKey = resolveNiceHashAlgoKey(m.algorithm.key);

      const rate =
        (paying as any)[nhAlgoKey] ??
        (paying as any)[nhAlgoKey.toUpperCase()] ??
        (paying as any)[nhAlgoKey.toLowerCase()];

      if (Number.isFinite(rate) && rate > 0) {
        revenueUsdPerDay = computeRevenueUsdPerDayFromNiceHash({
          payingSatPerUnitPerDay: rate,
          speedBasePerSec: speed.value,
          btcUsd: btc.usd,
        });

        bestCoinId = btcCoin?.id ?? null;
        bestCoinConfidence = 55;
        bestCoinReason =
          "NiceHash payout used (BTC payout). Hashrate.no best-coin unavailable for this algo/coin set.";
        revenueSource = "nicehash";
      }
    }

    // =========================
    // Fallback 2: static catalog fallback rate
    // =========================
    if (revenueUsdPerDay == null) {
      const dbKey = String(m.algorithm.key).trim().toLowerCase();
      const fallbackRate = FALLBACK_USD_PER_UNIT_DAY_BY_DB_KEY.get(dbKey);
      const fallbackUnit = FALLBACK_UNIT_BY_DB_KEY.get(dbKey);

      if (!fallbackRate || !fallbackUnit) {
        skipped++;
        continue;
      }

      const speedInUnit = baseToUnit(speed.value, fallbackUnit);
      if (speedInUnit == null) {
        skipped++;
        continue;
      }

      revenueUsdPerDay = fallbackRate * speedInUnit;
      bestCoinId = null;
      bestCoinConfidence = 10;
      bestCoinReason =
        "Static fallback rate used (algorithm catalog). No real best-coin source available.";
      revenueSource = "catalog-fallback";
    }

    if (revenueUsdPerDay == null) {
      skipped++;
      continue;
    }

    // =========================
    // ✅ Single source of truth: costs.ts for net profit + breakdown
    // =========================
    const breakdown = computeCostBreakdown({
      powerW: m.powerW,
      electricityUsdPerKwh: baselineElec,
      revenueUsdPerDay,

      poolFeePct,
      hostingUsdPerDay,

      hardwarePriceUsd: lowestPriceUsd,
      shippingUsd: lowestShippingUsd,
      vatUsd: null,
      otherOneTimeUsd: null,
    });

    const netProfitUsdPerDay = breakdown.totals.netProfitUsdPerDay;

    // ✅ PATCH: roiDays must be Int? (ceil + safety)
    const roiDays =
      breakdown.totals.roiDays != null && Number.isFinite(breakdown.totals.roiDays)
        ? Math.max(0, Math.ceil(breakdown.totals.roiDays))
        : null;

    const paybackDate = computePaybackDate({
      computedAt: computedBucket,
      roiDays,
    });

    const breakdownJson = {
      ...breakdown,
      meta: {
        computedAt: computedBucket.toISOString(),
        revenueSource,
        bestCoinId,
        bestCoinConfidence,
        bestCoinReason,
        paybackDate,
        baselineElectricityUsdPerKwh: baselineElec,
        poolFeePct,
        hostingUsdPerDay,
      },
    };

    rows.push({
      machineId: m.id,
      computedAt: computedBucket,

      electricityUsdPerKwh: dec5(baselineElec),

      bestCoinId,
      revenueUsdPerDay: dec6(revenueUsdPerDay),
      electricityUsdPerDay: dec6(breakdown.daily.electricityUsdPerDay),

      profitUsdPerDay: dec6(netProfitUsdPerDay),

      lowestPriceUsd: lowestPriceUsd == null ? null : dec2(lowestPriceUsd),
      roiDays,

      breakdown: breakdownJson as any,
      bestCoinConfidence:
        bestCoinConfidence == null ? null : clampInt(bestCoinConfidence, 0, 100),
      bestCoinReason,
    });
  }

  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    await prisma.profitabilitySnapshot.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  const finishedAt = new Date();
  return {
    ok: true,
    computedAt: computedBucket.toISOString(),
    bucket: "hour",
    durationMs: finishedAt.getTime() - runStartedAt.getTime(),
    machinesTotal: machines.length,
    snapshotsWritten: rows.length,
    skipped,
    btcUsd: btc.usd,
    btcSource: btc.source,
    baselineElectricityUsdPerKwh: baselineElec,
    poolFeePct,
    hostingUsdPerDay,
    machineIdsComputed: opts.machineIds?.length ? opts.machineIds : undefined,
    hashrateNo: {
      concurrency: HASHRATENO_CONCURRENCY,
      uniqueCandidateCoins: uniqueCandidateCoins.size,
    },
  };
}

/**
 * Backward-compat helper.
 */
export async function computeProfitabilityForMachine(
  machineId: string,
  opts: Omit<any, "machineIds"> = {}
) {
  return computeProfitabilitySnapshots({ ...opts, machineIds: [machineId] });
}
