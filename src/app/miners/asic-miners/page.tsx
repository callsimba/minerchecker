import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  convertToUsd,
  convertUsdToCurrency,
  formatMoney,
  getLatestFxRates,
  toNumber,
} from "@/server/public";
import { computeElectricityUsdPerDay } from "@/server/profitability/math";
import { CompareTray } from "@/components/compare-tray";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

const MAX_COMPARE = 5;
const REGIONS = ["GLOBAL", "US", "EU", "ASIA"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

// --- 1. MANUFACTURER CATALOG ---
const MANUFACTURER_LIST = [
  { slug: "bitmain", name: "Bitmain", logo: "/brands/bitmain.webp" },
  { slug: "microbt", name: "MicroBT", logo: "/brands/microbt.webp" },
  { slug: "iceriver", name: "Iceriver", logo: "/brands/iceriver.webp" },
  { slug: "canaan", name: "Canaan", logo: "/brands/canaan.webp" },
  { slug: "goldshell", name: "Goldshell", logo: "/brands/goldshell.webp" },
  { slug: "jasminer", name: "Jasminer", logo: "/brands/jasminer.webp" },
  { slug: "ibelink", name: "iBeLink", logo: "/brands/ibelink.webp" },
  { slug: "ipollo", name: "iPollo", logo: "/brands/ipollo.webp" },
  { slug: "bitaxe", name: "BitAxe", logo: "/brands/bitaxe.webp" },
  { slug: "auradine", name: "Auradine", logo: "/brands/auradine.webp" },
  { slug: "bitdeer", name: "Bitdeer", logo: "/brands/bitdeer.webp" },
  { slug: "bombax", name: "Bombax", logo: "/brands/bombax.webp" },
  { slug: "innosilicon", name: "Innosilicon", logo: "/brands/innosilicon.webp" },
  { slug: "elphapex", name: "Elphapex", logo: "/brands/elphapex.webp" },
  { slug: "desire", name: "Desire", logo: "/brands/desire.webp" },
  { slug: "wind-miner", name: "Wind Miner", logo: "/brands/wind-miner.webp" },
].sort((a, b) => a.name.localeCompare(b.name));

// --- UTILS ---

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
  overrides: Record<string, string | undefined>,
  excludeKeys: string[] = []
) {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(sp)) {
    if (excludeKeys.includes(k)) continue;
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

function formatReleaseAny(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (!Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
  }
  return String(value);
}

function normalizeToTh(hashrate: number, unit: string) {
  const u = (unit || "").toLowerCase();
  if (u.includes("ph")) return hashrate * 1000;
  if (u.includes("th")) return hashrate;
  if (u.includes("gh")) return hashrate / 1000;
  if (u.includes("mh")) return hashrate / 1_000_000;
  return 0;
}

function normalizeEfficiencyToJPerTh(val: number, unit: string) {
  const u = (unit || "").toLowerCase();
  if (u.includes("j/th")) return val;
  if (u.includes("j/gh")) return val * 1000;
  if (u.includes("w/th")) return val;
  if (u.includes("w/gh")) return val * 1000;
  return val;
}

function resolveManufacturer(args: {
  manufacturerRaw: string | null;
  name: string;
}): { displayName: string; logo?: string | null } {
  const raw = (args.manufacturerRaw ?? "").trim();
  const nameLower = args.name.toLowerCase();

  if (raw) {
    const directHit = MANUFACTURER_LIST.find(
      (m) => m.name.toLowerCase() === raw.toLowerCase() || m.slug === raw.toLowerCase()
    );
    if (directHit) return { displayName: directHit.name, logo: directHit.logo };
  }

  const inferred = MANUFACTURER_LIST.find((m) => {
    return nameLower.includes(m.slug) || nameLower.includes(m.name.toLowerCase());
  });

  if (inferred) return { displayName: inferred.name, logo: inferred.logo };

  return { displayName: raw || "Unknown", logo: null };
}

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** * Reusable StatPill for Header */
function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "cyan" | "purple" | "yellow";
}) {
  const colors = {
    default: "text-zinc-400",
    cyan: "text-cyan-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-3 transition-transform hover:scale-105">
      <div className={cn("text-xl font-bold tracking-tight", colors[tone] || "text-fg")}>{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</div>
    </div>
  );
}

// --- PAGE COMPONENT ---

export default async function AsicMinersPage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const q = String(firstParam(sp.q) ?? "").trim();
  const algorithm = String(firstParam(sp.algorithm) ?? "").trim();
  const manufacturer = String(firstParam(sp.manufacturer) ?? "").trim();
  const status = String(firstParam(sp.status) ?? "").trim();

  const currency = String(firstParam(sp.currency) ?? "USD").toUpperCase();
  const regionKey = String(firstParam(sp.region) ?? "GLOBAL").toUpperCase();
  const electricity = parseNum(String(firstParam(sp.electricity) ?? "0.10"), 0.10);

  const view = String(firstParam(sp.view) ?? "list").toLowerCase() === "grid" ? "grid" : "list";
  const sort = String(firstParam(sp.sort) ?? "profit").toLowerCase();

  const compareParam = String(firstParam(sp.compare) ?? "").trim();
  const compareIds = compareParam ? compareParam.split(",").filter(Boolean).slice(0, MAX_COMPARE) : [];
  const compareSet = new Set(compareIds);

  const fxRates = await getLatestFxRates();

  const algorithms = await prisma.algorithm.findMany({
    orderBy: { name: "asc" },
    select: { key: true, name: true },
  });

  const machinesRaw = await prisma.machine.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
      ...(algorithm ? { algorithm: { key: algorithm } } : {}),
      ...(manufacturer
        ? { manufacturer: { contains: manufacturer, mode: Prisma.QueryMode.insensitive } }
        : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      algorithm: true,
      vendorOfferings: {
        include: { vendor: true },
        where: { regionKey, inStock: true },
      },
      profitabilitySnapshots: {
        orderBy: { computedAt: "desc" },
        take: 1,
        include: { bestCoin: true },
      },
    },
    take: 500,
  });

  let enriched = machinesRaw.map((m) => {
    const rawHash = Number(m.hashrate);
    const th = normalizeToTh(rawHash, m.hashrateUnit);

    const snap = m.profitabilitySnapshots[0];
    const revenueUsd = snap ? toNumber((snap as any).revenueUsdPerDay) : null;
    const elecUsd = computeElectricityUsdPerDay(m.powerW, electricity);
    const profitUsd = revenueUsd != null ? revenueUsd - elecUsd : null;

    let bestPriceUsd: number | null = null;
    for (const off of m.vendorOfferings) {
      const p = toNumber(off.price);
      if (p != null) {
        const usd = convertToUsd(p, off.currency, fxRates);
        if (usd != null && (bestPriceUsd === null || usd < bestPriceUsd)) bestPriceUsd = usd;
      }
    }

    let roiDays: number | null = null;
    if (bestPriceUsd != null && profitUsd != null && profitUsd > 0) {
      roiDays = bestPriceUsd / profitUsd;
    }

    let efficiencyVal: number | null = null;
    let efficiencyLabel = "—";

    if ((m as any).efficiency && (m as any).efficiencyUnit) {
      const effNum = Number((m as any).efficiency);
      const effUnit = String((m as any).efficiencyUnit);
      efficiencyLabel = `${effNum} ${effUnit}`;
      efficiencyVal = Number.isFinite(effNum) ? normalizeEfficiencyToJPerTh(effNum, effUnit) : null;
    } else if (th > 0 && m.powerW > 0) {
      const jTh = m.powerW / th;
      efficiencyVal = jTh;
      efficiencyLabel = `${jTh.toFixed(1)} J/TH`;
    }

    const manuf = resolveManufacturer({
      manufacturerRaw: m.manufacturer,
      name: m.name,
    });

    // keep “settings” params (currency/region/electricity) but don’t carry list-only params into the machine page
    const machineQuery = buildQueryString(sp, {}, [
      "slug",
      "compare",
      "q",
      "algorithm",
      "manufacturer",
      "status",
      "view",
      "sort",
    ]);
    const machineHref = `/machines/${m.slug}${machineQuery}`;

    const imageUrl = (m as any).imageUrl ?? null;

    // --- Format values for Display strings ---
    const revenueDisplay =
      revenueUsd != null
        ? formatMoney(convertUsdToCurrency(revenueUsd, currency, fxRates) ?? revenueUsd, currency)
        : "—";

    const elecDisplay = formatMoney(
      convertUsdToCurrency(elecUsd, currency, fxRates) ?? elecUsd,
      currency
    );

    return {
      ...m,
      imageUrl,
      manufacturerData: manuf,
      profitUsd,
      revenueUsd,
      elecUsd,
      bestPriceUsd,
      roiDays,
      efficiencyVal,
      efficiencyLabel,
      th,
      machineHref,
      // Display strings
      profitDisplay:
        profitUsd != null
          ? formatMoney(convertUsdToCurrency(profitUsd, currency, fxRates) ?? profitUsd, currency)
          : "—",
      priceDisplay:
        bestPriceUsd != null
          ? formatMoney(convertUsdToCurrency(bestPriceUsd, currency, fxRates) ?? bestPriceUsd, currency)
          : "—",
      revenueDisplay,
      elecDisplay,
      algorithmName: m.algorithm.name,
      releaseLabel: formatReleaseAny(m.releaseDate),
      isProfitable: (profitUsd ?? -1) > 0,
      hasRevenueData: revenueUsd !== null,
      bestCoin: snap?.bestCoin?.name ?? null,
      // For CompareTray logic (pre-calc)
      snapshotNetProfitUsdPerDay: profitUsd,
      snapshotBaselineElectricityUsdPerKwh: electricity,
      offerCount: m.vendorOfferings.length,
      breakEvenRate: (m.powerW > 0 && revenueUsd) 
        ? revenueUsd / ((m.powerW/1000)*24) 
        : null
    };
  });

  if (sort === "profit") {
    enriched.sort((a, b) => (b.profitUsd ?? -Infinity) - (a.profitUsd ?? -Infinity));
  } else if (sort === "roi") {
    enriched.sort((a, b) => {
      if (a.roiDays === null) return 1;
      if (b.roiDays === null) return -1;
      return a.roiDays - b.roiDays;
    });
  } else if (sort === "price") {
    enriched.sort((a, b) => (a.bestPriceUsd ?? Infinity) - (b.bestPriceUsd ?? Infinity));
  } else if (sort === "efficiency") {
    enriched.sort((a, b) => {
      if (a.efficiencyVal === null) return 1;
      if (b.efficiencyVal === null) return -1;
      return a.efficiencyVal - b.efficiencyVal;
    });
  } else if (sort === "release") {
    enriched.sort(
      (a, b) => new Date(b.releaseDate ?? 0).getTime() - new Date(a.releaseDate ?? 0).getTime()
    );
  }

  const totalMiners = enriched.length;
  const profitableCount = enriched.filter((m) => m.isProfitable).length;
  const validEffMiners = enriched.filter((m) => m.efficiencyVal !== null);
  const avgEfficiency = validEffMiners.length
    ? validEffMiners.reduce((acc, m) => acc + (m.efficiencyVal || 0), 0) / validEffMiners.length
    : 0;

  const toggleCompareHref = (id: string) => {
    const current = new Set(compareIds);
    if (current.has(id)) current.delete(id);
    else if (current.size < MAX_COMPARE) current.add(id);
    return buildQueryString(sp, { compare: Array.from(current).join(",") || undefined });
  };

  // ✅ Create a Sanitized version for the Client Component (No Decimals)
  const compareItems = enriched.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    imageUrl: m.imageUrl,
    algorithmName: m.algorithmName,
    hashrate: String(m.hashrate), // Safe String
    hashrateUnit: m.hashrateUnit,
    powerW: m.powerW,
    revenueDisplay: m.revenueDisplay,
    elecDisplay: m.elecDisplay,
    profitDisplay: m.profitDisplay,
    isProfitable: m.isProfitable,
    roiDays: m.roiDays,
    priceDisplay: m.priceDisplay,
    efficiencyLabel: m.efficiencyLabel,
    breakEvenRate: m.breakEvenRate,
    offerCount: m.offerCount,
    bestCoin: m.bestCoin,
    snapshotNetProfitUsdPerDay: m.snapshotNetProfitUsdPerDay,
    snapshotBaselineElectricityUsdPerKwh: m.snapshotBaselineElectricityUsdPerKwh,
  }));

  return (
    <div className="min-h-screen bg-zinc-950 pb-28 text-slate-200">
      
      {/* 1. Market Header (Glass Hero) */}
      <div className="relative overflow-hidden border-b border-white/5 bg-zinc-900/50 pt-10 pb-8 px-4 md:px-6 shadow-xl">
         {/* Background Mesh */}
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-zinc-900/0 to-zinc-950/0 pointer-events-none" />
         
         <div className="relative z-10 mx-auto max-w-[1400px]">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
             <div>
               <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 mb-4">
                 <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                 </span>
                 Live Market Data
               </div>
               <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">ASIC Hardware</h1>
               <p className="mt-2 text-slate-400 max-w-xl text-sm md:text-base leading-relaxed">
                 Real-time profitability, vendor stock, and efficiency benchmarks for every major ASIC model.
               </p>
             </div>
             
             <div className="flex flex-wrap gap-4">
               <StatPill label="Models Tracked" value={String(totalMiners)} tone="default" />
               <StatPill label="Profitable" value={String(profitableCount)} tone="cyan" />
               <StatPill label="Avg Efficiency" value={`${avgEfficiency.toFixed(1)} J/TH`} tone="purple" />
             </div>
           </div>
         </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 mt-8">
        
        {/* 2. Control Command Center */}
        <div className="sticky top-4 z-40 mb-8 rounded-3xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md">
          <form className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <input type="hidden" name="view" value={view} />
            {compareIds.length > 0 && <input type="hidden" name="compare" value={compareParam} />}

            {/* Top Row: Search & Filters */}
            <div className="flex flex-1 flex-wrap gap-3">
               <div className="relative group min-w-[200px] flex-1">
                 <div className="absolute inset-y-0 left-3 flex items-center text-zinc-500 group-focus-within:text-cyan-400 transition-colors">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                 </div>
                 <input
                   name="q"
                   defaultValue={q}
                   placeholder="Search model..."
                   className="w-full h-11 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-cyan-500/50 focus:bg-black/40 outline-none transition-all"
                 />
               </div>

               <select
                 name="algorithm"
                 defaultValue={algorithm}
                 className="h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-sm text-zinc-300 outline-none cursor-pointer focus:border-cyan-500/50 hover:bg-white/5 transition-all"
               >
                 <option value="" className="bg-zinc-900">All Algorithms</option>
                 {algorithms.map((a) => (
                   <option key={a.key} value={a.key} className="bg-zinc-900">{a.name}</option>
                 ))}
               </select>

               <select
                 name="manufacturer"
                 defaultValue={manufacturer}
                 className="h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-sm text-zinc-300 outline-none cursor-pointer focus:border-cyan-500/50 hover:bg-white/5 transition-all"
               >
                 <option value="" className="bg-zinc-900">All Brands</option>
                 {MANUFACTURER_LIST.map((m) => (
                   <option key={m.slug} value={m.name} className="bg-zinc-900">{m.name}</option>
                 ))}
               </select>
            </div>

            <div className="hidden lg:block w-px h-8 bg-white/10 mx-2" />

            {/* Bottom Row: Settings & Actions */}
            <div className="flex flex-wrap gap-3 items-center">
               <div className="flex items-center gap-2 bg-black/20 rounded-xl border border-white/10 p-1">
                  <select
                    name="region"
                    defaultValue={regionKey}
                    className="h-9 px-2 bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-cyan-400"
                  >
                    {REGIONS.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                  </select>
                  <div className="w-px h-4 bg-white/10" />
                  <select
                    name="currency"
                    defaultValue={currency}
                    className="h-9 px-2 bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-cyan-400"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                  </select>
               </div>

               <div className="flex items-center gap-2 bg-black/20 rounded-xl border border-white/10 px-3 py-1 h-11" title="Electricity Cost">
                 <span className="text-yellow-500 font-bold text-lg">⚡</span>
                 <input
                   name="electricity"
                   defaultValue={electricity}
                   className="w-12 bg-transparent text-sm font-bold text-white text-right outline-none font-mono focus:text-cyan-400"
                 />
                 <span className="text-xs text-zinc-500 font-medium">/kWh</span>
               </div>

               <select
                 name="sort"
                 defaultValue={sort}
                 className="h-11 px-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-sm font-bold text-cyan-400 outline-none cursor-pointer hover:bg-cyan-500/20 transition-all"
               >
                 <option value="profit" className="bg-zinc-900">Sort: Profit</option>
                 <option value="roi" className="bg-zinc-900">Sort: ROI</option>
                 <option value="efficiency" className="bg-zinc-900">Sort: Efficiency</option>
                 <option value="price" className="bg-zinc-900">Sort: Price</option>
                 <option value="release" className="bg-zinc-900">Sort: Release</option>
               </select>

               <button className="h-11 px-6 bg-white text-black text-sm font-bold rounded-xl shadow-lg hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95">
                 Update
               </button>
            </div>
          </form>
        </div>

        {/* 3. View Toggles & Count */}
        <div className="flex justify-between items-center mb-6 px-1">
          <div className="text-sm text-zinc-400">
            Showing <strong className="text-white">{enriched.length}</strong> results
          </div>
          <div className="flex bg-zinc-900 p-1 rounded-lg border border-white/10">
            <Link
              href={buildQueryString(sp, { view: "list" })}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                view === "list" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              List
            </Link>
            <Link
              href={buildQueryString(sp, { view: "grid" })}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                view === "grid" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Grid
            </Link>
          </div>
        </div>

        {/* 4. Data Display */}
        {view === "list" ? (
          <div className="space-y-2">
            {/* Desktop Header */}
            <div className="hidden lg:grid grid-cols-[50px_3fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <div>Cmp</div>
              <div>Model</div>
              <div>Hashrate</div>
              <div>Power</div>
              <div>Eff.</div>
              <div>Algo</div>
              <div className="text-right">ROI</div>
              <div className="text-right">Price</div>
              <div className="text-right">Profit</div>
            </div>

            {enriched.map((m: any) => {
              const isSelected = compareSet.has(m.id);
              const profitColor = (m.profitUsd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400";

              return (
                <div
                  key={m.id}
                  className="group relative bg-zinc-900/40 border border-white/5 rounded-2xl p-4 hover:bg-zinc-900/80 hover:border-white/10 transition-all duration-300 hover:shadow-lg backdrop-blur-sm"
                >
                  {/* --- MOBILE LIST LAYOUT (< lg) --- */}
                  <div className="block lg:hidden">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 bg-white/5 rounded-xl p-2 border border-white/5 shrink-0">
                          {m.imageUrl ? (
                            <Image
                              src={m.imageUrl}
                              alt={m.name}
                              width={48}
                              height={48}
                              className="object-contain w-full h-full"
                            />
                          ) : null}
                        </div>
                        <div>
                          <Link
                            href={m.machineHref}
                            className="block font-bold text-white text-base hover:text-cyan-400 transition-colors"
                          >
                            {m.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-zinc-500">{m.manufacturerData.displayName}</span>
                             <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400 border border-white/5">
                               {m.algorithm.name}
                             </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {m.hasRevenueData ? (
                          <>
                            <div className={`font-bold ${profitColor} text-base`}>{m.profitDisplay}</div>
                            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Daily Net</div>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-600 italic">No Data</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                        <div className="text-zinc-500 mb-0.5 text-[10px] uppercase">Price</div>
                        <div className="text-white font-bold">{m.bestPriceUsd ? m.priceDisplay : "—"}</div>
                      </div>
                      <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                        <div className="text-zinc-500 mb-0.5 text-[10px] uppercase">ROI</div>
                        <div className="text-white">{m.roiDays ? `${Math.ceil(m.roiDays)}d` : "—"}</div>
                      </div>
                      <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                        <div className="text-zinc-500 mb-0.5 text-[10px] uppercase">Eff.</div>
                        <div className="text-white">{m.efficiencyLabel}</div>
                      </div>
                    </div>
                  </div>

                  {/* --- DESKTOP GRID LAYOUT (>= lg) --- */}
                  <div className="hidden lg:grid grid-cols-[50px_3fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 items-center">
                    {/* Compare Checkbox */}
                    <div>
                      <Link
                        href={toggleCompareHref(m.id)}
                        className={cn(
                          "w-6 h-6 flex items-center justify-center rounded-lg border transition-all duration-200",
                          isSelected
                            ? "bg-cyan-500 border-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                            : "border-zinc-700 text-transparent hover:border-zinc-500"
                        )}
                      >
                        ✓
                      </Link>
                    </div>

                    {/* Identity */}
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-white/5 rounded-xl p-1.5 border border-white/5 shrink-0 backdrop-blur-sm">
                        {m.imageUrl ? (
                          <Image
                            src={m.imageUrl}
                            alt={m.name}
                            width={40}
                            height={40}
                            className="object-contain w-full h-full group-hover:scale-110 transition-transform"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={m.machineHref}
                          className="block font-bold text-white text-sm hover:text-cyan-400 truncate transition-colors"
                        >
                          {m.name}
                        </Link>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {m.manufacturerData.displayName} • {m.releaseLabel}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-sm font-mono text-zinc-300">
                      <span className="text-white font-bold">{m.hashrate}</span>{" "}
                      <span className="text-xs text-zinc-500">{m.hashrateUnit}</span>
                    </div>
                    <div className="text-sm font-mono text-zinc-300">
                      {m.powerW} <span className="text-xs text-zinc-500">W</span>
                    </div>
                    <div className="text-sm font-mono text-zinc-400">{m.efficiencyLabel}</div>

                    {/* Algo */}
                    <div>
                        <span className="inline-flex items-center rounded bg-white/5 px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border border-white/5">
                            {m.algorithm.name}
                        </span>
                    </div>

                    {/* ROI */}
                    <div className="text-right text-sm font-mono">
                      {m.roiDays ? (
                        <span className="text-yellow-500 font-bold">{Math.ceil(m.roiDays)}d</span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      {m.bestPriceUsd ? (
                        <div className="text-white font-bold text-sm">{m.priceDisplay}</div>
                      ) : (
                        <span className="text-xs text-zinc-600">No Offer</span>
                      )}
                    </div>

                    {/* Profit */}
                    <div className="text-right">
                      {m.hasRevenueData ? (
                        <>
                          <div className={`font-bold ${profitColor} text-sm`}>{m.profitDisplay}</div>
                          <div className="text-[10px] text-zinc-600">/day</div>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-700 italic" title="No revenue data available">
                          No Data
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // GRID VIEW
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {enriched.map((m: any) => {
              const isSelected = compareSet.has(m.id);
              const profitColor = (m.profitUsd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400";

              return (
                <div
                  key={m.id}
                  className="group bg-zinc-900/40 border border-white/5 rounded-3xl p-5 hover:border-cyan-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-900/10 flex flex-col relative overflow-hidden backdrop-blur-sm"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  {/* Top Bar */}
                  <div className="flex justify-between items-start mb-6 z-10 relative">
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[10px] font-bold text-zinc-400 uppercase tracking-wider backdrop-blur-md">
                      {m.algorithm.name}
                    </span>
                    <Link
                      href={toggleCompareHref(m.id)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-xl border transition-all duration-200",
                        isSelected
                          ? "bg-cyan-500 border-cyan-500 text-black shadow-lg shadow-cyan-500/30"
                          : "bg-black/20 border-white/10 text-zinc-500 hover:border-white/30 hover:text-white"
                      )}
                    >
                      {isSelected ? "✓" : "+"}
                    </Link>
                  </div>

                  {/* Image */}
                  <Link href={m.machineHref} className="flex-1 w-full flex items-center justify-center mb-8 relative z-10">
                    <div className="relative w-full aspect-[4/3] max-h-40">
                      {m.imageUrl ? (
                        <Image
                          src={m.imageUrl}
                          alt={m.name}
                          fill
                          className="object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-2xl"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="text-4xl opacity-10 flex items-center justify-center h-full w-full grayscale">🧊</div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="relative z-10">
                    <Link
                      href={m.machineHref}
                      className="block font-bold text-white text-lg leading-tight hover:text-cyan-400 transition-colors mb-1 truncate"
                    >
                      {m.name}
                    </Link>
                    <div className="text-xs text-zinc-500 mb-5">{m.manufacturerData.displayName}</div>

                    {/* Matrix */}
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                        <div className="text-zinc-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Hashrate</div>
                        <div className="text-white font-mono text-sm font-bold">
                          {m.hashrate} <span className="text-[10px] text-zinc-600 font-normal">{m.hashrateUnit}</span>
                        </div>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                        <div className="text-zinc-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Efficiency</div>
                        <div className="text-white font-mono text-sm font-bold">{m.efficiencyLabel}</div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-end justify-between border-t border-white/5 pt-4">
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Best Price</div>
                        <div className="text-white font-bold text-lg">
                          {m.bestPriceUsd ? m.priceDisplay : <span className="text-zinc-700 text-sm font-normal">No Offer</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        {m.hasRevenueData ? (
                          <>
                            <div className={`font-bold ${profitColor} text-lg`}>{m.profitDisplay}</div>
                            <div className="text-[10px] text-zinc-600 font-medium">Daily Net</div>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-700 italic">No Data</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Compare Tray */}
        <CompareTray items={compareItems} maxCompare={MAX_COMPARE} />
      </div>
    </div>
  );
}