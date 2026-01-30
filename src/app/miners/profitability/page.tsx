// src/app/miners/profitability/page.tsx
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import {
  convertToUsd,
  convertUsdToCurrency,
  getLatestFxRates,
  toNumber,
} from "@/server/public";
import { ProfitabilityFilters } from "./filters";
import { CompareTray, type CompareTrayItem } from "@/components/compare-tray";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

const MAX_COMPARE = 5;
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];
const REGIONS = ["GLOBAL", "US", "EU", "ASIA"];

// ✅ What-if presets (instant mini panel)
const WHAT_IF_RATES = [0.05, 0.1, 0.15];

// ---------- Utils ----------
function parseNum(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function buildQueryString(
  sp: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>
) {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(sp)) {
    const v = firstParam(val);
    if (v != null && v !== "") p.set(k, String(v));
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const clamp = (n: number) => Math.max(0, Math.floor(n));
  let interval = seconds / 31536000;
  if (interval > 1) return clamp(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return clamp(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return clamp(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return clamp(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return clamp(interval) + "m ago";
  return clamp(seconds) + "s ago";
}

function normalizeToTh(hashrate: number, unit: string) {
  const u = (unit || "").toLowerCase();
  if (u.includes("ph")) return hashrate * 1000;
  if (u.includes("th")) return hashrate;
  if (u.includes("gh")) return hashrate / 1000;
  if (u.includes("mh")) return hashrate / 1_000_000;
  if (u.includes("kh")) return hashrate / 1_000_000_000;
  return 0;
}

function normalizeEfficiencyToJPerTh(val: number, unit: string) {
  const u = (unit || "").toLowerCase();
  if (!Number.isFinite(val)) return null;
  if (u.includes("j/th")) return val;
  if (u.includes("j/gh")) return val * 1000;
  if (u.includes("w/th")) return val;
  if (u.includes("w/gh")) return val * 1000;
  return val;
}

// ✅ Cached Intl formatter
const fmtCache = new Map<string, Intl.NumberFormat>();
function money(amount: number, currency: string) {
  const cur = currency.toUpperCase();
  let fmt = fmtCache.get(cur);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    });
    fmtCache.set(cur, fmt);
  }
  return fmt.format(amount);
}

// ---------- Types (explicit to prevent Prisma TS drift / stale client issues) ----------
type SnapshotRow = {
  computedAt: Date;
  revenueUsdPerDay: unknown;
  electricityUsdPerDay: unknown;
  profitUsdPerDay: unknown;
  electricityUsdPerKwh: unknown;
  lowestPriceUsd: unknown;
  roiDays: number | null;
  breakdown?: unknown | null;
  bestCoin?: { symbol: string } | null;
};

type MachineRow = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  hashrate: string;
  hashrateUnit: string;
  powerW: number;
  efficiency: string | null;
  efficiencyUnit: string | null;
  algorithm: { key: string; name: string } | null;
  vendorOfferings: Array<{ price: unknown; currency: string }>;
  profitabilitySnapshots: SnapshotRow[];
};

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const electricity = parseNum(
    String(firstParam(sp.electricity) ?? "0.10"),
    0.1
  );
  const currency = String(firstParam(sp.currency) ?? "USD").toUpperCase();
  const regionKey = String(firstParam(sp.region) ?? "GLOBAL").toUpperCase();
  const sort = String(firstParam(sp.sort) ?? "profit").toLowerCase();
  const algorithm = String(firstParam(sp.algorithm) ?? "").trim();

  const profitableOnly = String(firstParam(sp.profitable) ?? "") === "on";
  const offersOnly = String(firstParam(sp.offers) ?? "") === "on";

  const compareParam = String(firstParam(sp.compare) ?? "").trim();
  const compareIds = compareParam
    ? compareParam
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, MAX_COMPARE)
    : [];
  const compareSet = new Set(compareIds);

  // ✅ Parallelize
  const [fxRates, algorithms, machinesRawUnsafe] = await Promise.all([
    getLatestFxRates(),
    prisma.algorithm.findMany({
      orderBy: { name: "asc" },
      select: { key: true, name: true },
    }),
    prisma.machine.findMany({
      where: {
        ...(algorithm ? { algorithm: { key: algorithm } } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        hashrate: true,
        hashrateUnit: true,
        powerW: true,
        efficiency: true,
        efficiencyUnit: true,
        algorithm: { select: { key: true, name: true } },

        vendorOfferings: {
          where: {
            inStock: true,
            // GLOBAL means "show all regions"
            ...(regionKey === "GLOBAL" ? {} : { regionKey }),
          },
          select: { price: true, currency: true },
        },

        profitabilitySnapshots: {
          orderBy: { computedAt: "desc" },
          take: 1,
          // NOTE:
          // If your Prisma Client is stale (not regenerated after adding breakdown),
          // TS will complain. This `as any` keeps build green.
          select: {
            computedAt: true,
            revenueUsdPerDay: true,
            electricityUsdPerDay: true,
            profitUsdPerDay: true,
            electricityUsdPerKwh: true,
            lowestPriceUsd: true,
            roiDays: true,
            breakdown: true,
            bestCoin: { select: { symbol: true } },
          } as any,
        },
      },
      take: 200,
    }),
  ]);

  const machinesRaw = machinesRawUnsafe as unknown as MachineRow[];

  function bestPriceUsdFor(offers: Array<{ price: unknown; currency: string }>) {
    let best: number | null = null;
    let count = 0;

    for (const off of offers) {
      const p = toNumber(off.price);
      if (p == null) continue;

      const usd = convertToUsd(p, off.currency, fxRates);
      if (usd == null) continue;

      count++;
      if (best == null || usd < best) best = usd;
    }

    return { bestPriceUsd: best, offerCount: count };
  }

  function toDisplay(usd: number) {
    const converted = convertUsdToCurrency(usd, currency, fxRates);
    const value = converted ?? usd;
    return money(value, converted == null ? "USD" : currency);
  }

  /**
   * ✅ Only "what-if" electricity adjustment client-side.
   * Snapshot profit is NET profit from your decision engine (fees + hosting + power).
   * We adjust by electricity delta using machine kWh/day.
   */
  function adjustProfitForElectricity(params: {
    snapNetProfitUsdPerDay: number | null;
    snapBaselineElectricityUsdPerKwh: number | null;
    powerW: number;
    userElectricityUsdPerKwh: number;
  }) {
    const {
      snapNetProfitUsdPerDay,
      snapBaselineElectricityUsdPerKwh,
      powerW,
      userElectricityUsdPerKwh,
    } = params;

    if (snapNetProfitUsdPerDay == null) return null;

    const kwhPerDay = (Math.max(0, powerW) / 1000) * 24;
    if (kwhPerDay <= 0) return snapNetProfitUsdPerDay;

    if (snapBaselineElectricityUsdPerKwh == null) return snapNetProfitUsdPerDay;

    const deltaUsdPerDay =
      (userElectricityUsdPerKwh - snapBaselineElectricityUsdPerKwh) * kwhPerDay;

    return snapNetProfitUsdPerDay - deltaUsdPerDay;
  }

  // 1) Enrich (numbers normalized at boundary)
  let enriched = machinesRaw.map((m) => {
    const snap = (m.profitabilitySnapshots?.[0] as SnapshotRow | undefined) ?? null;

    const snapRevenueUsd = snap ? toNumber(snap.revenueUsdPerDay) : null;
    const snapElecUsdDayBaseline = snap ? toNumber(snap.electricityUsdPerDay) : null;
    const snapNetProfitUsdBaseline = snap ? toNumber(snap.profitUsdPerDay) : null;
    const snapBaselineElec = snap ? toNumber(snap.electricityUsdPerKwh) : null;

    const dailyKwh = (Math.max(0, m.powerW ?? 0) / 1000) * 24;

    // User electricity cost display (simple and explainable)
    const elecCostUsdUser = dailyKwh * electricity;

    // ✅ Use snapshot net profit; adjust only by electricity delta
    const profitUsd = adjustProfitForElectricity({
      snapNetProfitUsdPerDay: snapNetProfitUsdBaseline,
      snapBaselineElectricityUsdPerKwh: snapBaselineElec,
      powerW: m.powerW ?? 0,
      userElectricityUsdPerKwh: electricity,
    });

    // Break-even = baseline elec + (net profit baseline / kWh/day)
    // If you pay this rate, profit becomes ~0.
    const breakEvenRate =
      snapNetProfitUsdBaseline != null && dailyKwh > 0 && snapBaselineElec != null
        ? snapBaselineElec + snapNetProfitUsdBaseline / dailyKwh
        : null;

    const { bestPriceUsd, offerCount } = bestPriceUsdFor(m.vendorOfferings ?? []);

    const snapLowestPriceUsd = snap ? toNumber(snap.lowestPriceUsd) : null;
    const priceUsdForRoi = snapLowestPriceUsd ?? bestPriceUsd;

    // ROI: prefer snapshot roiDays if present, otherwise compute using user-adjusted profit
    const snapRoiDays = snap?.roiDays ?? null;

    let roiDays: number | null = null;
    if (snapRoiDays != null && Number.isFinite(snapRoiDays)) {
      roiDays = snapRoiDays;
    } else if (priceUsdForRoi != null && profitUsd != null && profitUsd > 0) {
      const v = priceUsdForRoi / profitUsd;
      roiDays = Number.isFinite(v) ? v : null;
    }

    // Efficiency
    let efficiencyLabel = "—";
    let efficiencyVal: number | null = null;

    const th = normalizeToTh(
      Number(m.hashrate ?? 0),
      String(m.hashrateUnit ?? "")
    );

    if (m.efficiency != null && m.efficiencyUnit) {
      const v = normalizeEfficiencyToJPerTh(
        Number(m.efficiency),
        m.efficiencyUnit
      );
      if (v != null && Number.isFinite(v)) {
        efficiencyVal = v;
        efficiencyLabel = `${m.efficiency} ${m.efficiencyUnit}`;
      }
    } else if (th > 0 && (m.powerW ?? 0) > 0) {
      const jTh = (m.powerW ?? 0) / th;
      if (Number.isFinite(jTh)) {
        efficiencyVal = jTh;
        efficiencyLabel = `${jTh.toFixed(1)} J/TH`;
      }
    }

    const isProfitable = (profitUsd ?? -1) > 0;

    const whatIf = WHAT_IF_RATES.map((rate) => {
      const pUsd = adjustProfitForElectricity({
        snapNetProfitUsdPerDay: snapNetProfitUsdBaseline,
        snapBaselineElectricityUsdPerKwh: snapBaselineElec,
        powerW: m.powerW ?? 0,
        userElectricityUsdPerKwh: rate,
      });

      if (pUsd == null) {
        return {
          rate,
          profitUsd: null as number | null,
          profitDisplay: "—",
          profitable: false,
        };
      }

      return {
        rate,
        profitUsd: pUsd,
        profitDisplay: toDisplay(pUsd),
        profitable: pUsd > 0,
      };
    });

    return {
      ...m,
      snapshotTime: snap?.computedAt ?? null,
      bestCoin: snap?.bestCoin?.symbol ?? null,
      breakdown: (snap as any)?.breakdown ?? null,

      // normalized snapshot values (baseline engine values)
      revenueUsd: snapRevenueUsd,
      snapshotElectricityUsdPerDay: snapElecUsdDayBaseline,
      snapshotNetProfitUsdPerDay: snapNetProfitUsdBaseline,
      snapshotBaselineElectricityUsdPerKwh: snapBaselineElec,

      // user view values
      elecCostUsd: elecCostUsdUser,
      profitUsd,

      breakEvenRate,
      bestPriceUsd,
      roiDays,
      efficiencyVal,
      efficiencyLabel,
      isProfitable,
      offerCount,

      revenueDisplay: snapRevenueUsd != null ? toDisplay(snapRevenueUsd) : "—",
      elecDisplay: toDisplay(elecCostUsdUser),
      profitDisplay: profitUsd != null ? toDisplay(profitUsd) : "—",
      priceDisplay: bestPriceUsd != null ? toDisplay(bestPriceUsd) : "—",

      machineHref: `/machines/${m.slug}`,
      whatIf,
    };
  });

  // 2) Filters
  if (profitableOnly) enriched = enriched.filter((m) => m.isProfitable);
  if (offersOnly) enriched = enriched.filter((m) => m.offerCount > 0);

  // 3) Sorting
  if (sort === "roi") {
    enriched.sort((a, b) => {
      if (a.roiDays == null) return 1;
      if (b.roiDays == null) return -1;
      return a.roiDays - b.roiDays;
    });
  } else if (sort === "efficiency") {
    enriched.sort((a, b) => {
      if (a.efficiencyVal == null) return 1;
      if (b.efficiencyVal == null) return -1;
      return a.efficiencyVal - b.efficiencyVal;
    });
  } else if (sort === "price") {
    enriched.sort(
      (a, b) => (a.bestPriceUsd ?? Infinity) - (b.bestPriceUsd ?? Infinity)
    );
  } else {
    enriched.sort(
      (a, b) => (b.profitUsd ?? -Infinity) - (a.profitUsd ?? -Infinity)
    );
  }

  // Stats
  const topProfit =
    enriched.length > 0
      ? enriched.reduce((prev, curr) =>
          (curr.profitUsd ?? -Infinity) > (prev.profitUsd ?? -Infinity)
            ? curr
            : prev
        )
      : null;

  const bestRoiCandidates = enriched.filter((m) => m.roiDays != null);
  const bestRoi =
    bestRoiCandidates.length > 0
      ? bestRoiCandidates.reduce((prev, curr) =>
          (curr.roiDays ?? Infinity) < (prev.roiDays ?? Infinity) ? curr : prev
        )
      : null;

  const profitableCount = enriched.filter((m) => m.isProfitable).length;
  const profitablePct =
    enriched.length > 0
      ? Math.round((profitableCount / enriched.length) * 100)
      : 0;

  const latestSnapshot =
    (enriched
      .map((m) => m.snapshotTime)
      .filter(Boolean)
      .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as
      | Date
      | undefined) ?? null;

  // ✅ Compare tray items only when 2+ selected
  const compareRows: CompareTrayItem[] =
    compareIds.length < 2
      ? []
      : compareIds
          .map((id) => enriched.find((x) => x.id === id))
          .filter(Boolean)
          .map((m) => ({
            id: m!.id,
            name: m!.name,
            slug: m!.slug,
            imageUrl: (m as any).imageUrl ?? null,
            algorithmName: m!.algorithm?.name ?? "—",
            hashrate: String(m!.hashrate ?? ""),
            hashrateUnit: String(m!.hashrateUnit ?? ""),
            powerW: Number(m!.powerW ?? 0),
            revenueDisplay: m!.revenueDisplay,
            elecDisplay: m!.elecDisplay,
            profitDisplay: m!.profitDisplay,
            isProfitable: m!.isProfitable,
            roiDays: m!.roiDays,
            priceDisplay: m!.priceDisplay,
            efficiencyLabel: m!.efficiencyLabel,
            breakEvenRate: m!.breakEvenRate,
            offerCount: m!.offerCount,
            bestCoin: m!.bestCoin ?? null,
            whatIf: m!.whatIf,
          }));

  return (
    <div className="min-h-screen bg-[#0b0e14] pb-28 text-slate-200">
      <header className="border-b border-white/5 bg-[#151a2a] pt-8 pb-6 px-4 md:px-6 sticky top-0 z-40 shadow-2xl">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-white tracking-tight">
                  Profitability Cockpit
                </h1>
                {latestSnapshot && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    Updated {timeAgo(latestSnapshot)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-slate-400 text-sm max-w-2xl">
                Decision-engine driven net profit (fees + hosting + power). Electricity “what-if” adjusts profit without breaking consistency.
              </p>
            </div>

            <ProfitabilityFilters
              algorithms={algorithms}
              locations={REGIONS}
              currencies={CURRENCIES}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 mt-8">
        {enriched.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-[#1a202c] to-[#151a2a] border border-emerald-500/20 rounded-2xl p-5">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                Top Earner
              </div>
              <div className="text-2xl font-black text-white">
                {topProfit?.profitDisplay ?? "—"}{" "}
                <span className="text-sm text-slate-500 font-medium">/day</span>
              </div>
              <div className="mt-2 text-sm text-slate-300 truncate">
                {topProfit?.name ?? "—"}
              </div>
            </div>

            <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-5">
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                Fastest ROI
              </div>
              <div className="text-2xl font-black text-white">
                {bestRoi?.roiDays ? Math.ceil(bestRoi.roiDays) : "—"}{" "}
                <span className="text-sm text-slate-500 font-medium">days</span>
              </div>
              <div className="mt-2 text-sm text-slate-300 truncate">
                {bestRoi?.name ?? "No price data"}
              </div>
            </div>

            <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-5">
              <div className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">
                Market Health
              </div>
              <div className="text-2xl font-black text-white">{profitablePct}%</div>
              <div className="mt-2 text-xs text-slate-500">
                {profitableCount} of {enriched.length} profitable at $
                {electricity.toFixed(2)}/kWh
              </div>
            </div>

            <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">
                Break-even for Top Miner:
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {topProfit?.breakEvenRate
                  ? `$${topProfit.breakEvenRate.toFixed(3)}`
                  : "—"}{" "}
                <span className="text-sm text-slate-600">/kWh</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#151a2a] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/5 flex flex-wrap gap-3 items-center justify-between bg-[#0b0e14]/40">
            <div className="flex gap-2">
              <Link
                href={buildQueryString(sp, { sort: "profit" })}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sort === "profit"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "text-slate-500 hover:text-white hover:bg-white/5"
                }`}
              >
                Profit
              </Link>
              <Link
                href={buildQueryString(sp, { sort: "roi" })}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sort === "roi"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "text-slate-500 hover:text-white hover:bg-white/5"
                }`}
              >
                ROI
              </Link>
              <Link
                href={buildQueryString(sp, { sort: "efficiency" })}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sort === "efficiency"
                    ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    : "text-slate-500 hover:text-white hover:bg-white/5"
                }`}
              >
                Efficiency
              </Link>
            </div>

            <div className="text-[10px] text-slate-500 font-mono">
              Showing {enriched.length} miners • What-if: $0.05 / $0.10 / $0.15
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0b0e14] text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="p-4 w-12">Cmp</th>
                  <th className="p-4">Machine</th>
                  <th className="p-4">Algorithm</th>
                  <th className="p-4 text-right">Revenue</th>
                  <th className="p-4 text-right">Elec</th>
                  <th className="p-4 text-right">Net</th>
                  <th className="p-4 text-right">What-if</th>
                  <th className="p-4 text-right">ROI</th>
                  <th className="p-4 text-right">Break-even</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {enriched.map((m) => {
                  const isSelected = compareSet.has(m.id);
                  const toggleLink = buildQueryString(sp, {
                    compare: isSelected
                      ? compareIds.filter((id) => id !== m.id).join(",") ||
                        undefined
                      : [...compareIds, m.id]
                          .slice(0, MAX_COMPARE)
                          .join(","),
                  });

                  const profitTone =
                    m.profitUsd == null
                      ? "text-slate-500"
                      : m.isProfitable
                      ? "text-emerald-400"
                      : "text-red-500";

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-white/[0.02] transition-colors group align-top"
                    >
                      <td className="p-4">
                        <Link
                          href={toggleLink}
                          scroll={false}
                          className={`w-5 h-5 flex items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "bg-orange-500 border-orange-500 text-white"
                              : "border-slate-700 text-slate-500 hover:border-slate-400"
                          }`}
                          title={isSelected ? "Remove from compare" : "Add to compare"}
                        >
                          {isSelected && "✓"}
                        </Link>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-[#0b0e14] rounded-lg p-1 border border-slate-800 shrink-0">
                            {m.imageUrl ? (
                              <Image
                                src={m.imageUrl}
                                alt={m.name}
                                width={40}
                                height={40}
                                className="object-contain w-full h-full"
                              />
                            ) : null}
                          </div>
                          <div>
                            <Link
                              href={m.machineHref}
                              className="font-bold text-white text-sm hover:text-orange-400 block"
                            >
                              {m.name}
                            </Link>
                            <div className="text-[10px] text-slate-500 flex gap-2">
                              <span>
                                {m.hashrate} {m.hashrateUnit}
                              </span>
                              <span>•</span>
                              <span>{m.powerW}W</span>
                              <span>•</span>
                              <span className="text-slate-600">
                                {m.efficiencyLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 bg-[#0b0e14] px-2 py-1 rounded border border-slate-800">
                            {m.algorithm?.name ?? "—"}
                          </span>
                          {m.bestCoin && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {m.bestCoin}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-right font-mono text-sm text-slate-300">
                        {m.revenueDisplay}
                      </td>
                      <td className="p-4 text-right font-mono text-sm text-red-400/80">
                        -{m.elecDisplay}
                      </td>

                      <td className="p-4 text-right">
                        {m.revenueUsd !== null ? (
                          <div className={`font-bold text-sm ${profitTone}`}>
                            {m.profitDisplay}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 italic">
                            No Feed
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {m.whatIf.map((w) => {
                            const cls =
                              w.profitUsd == null
                                ? "border-slate-700 text-slate-500"
                                : w.profitable
                                ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                                : "border-red-500/30 text-red-300 bg-red-500/10";

                            return (
                              <div
                                key={w.rate}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-bold font-mono ${cls}`}
                                title={`Profit/day at $${w.rate.toFixed(2)}/kWh`}
                              >
                                <span className="text-slate-500 mr-1">
                                  ${w.rate.toFixed(2)}:
                                </span>
                                {w.profitDisplay}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        {m.roiDays ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {Math.ceil(m.roiDays)}d
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                        {m.offerCount > 0 && (
                          <div className="text-[9px] text-slate-500 mt-1">
                            {m.offerCount} offers
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-right font-mono text-xs text-slate-500">
                        {m.breakEvenRate ? `$${m.breakEvenRate.toFixed(3)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {enriched.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4 opacity-50">📉</div>
              <h3 className="text-white font-bold">No profitability data found</h3>
              <p className="text-slate-500 mt-2 text-sm">
                Try selecting a different algorithm or electricity rate.
              </p>
            </div>
          )}
        </div>

        <CompareTray items={compareRows} maxCompare={MAX_COMPARE} />
      </div>
    </div>
  );
}
