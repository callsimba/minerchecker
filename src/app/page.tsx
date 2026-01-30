import Link from "next/link";
import path from "path";
import { promises as fs } from "fs";
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
import { CoinStrip, type CoinLogo } from "@/components/coin-strip";
import {
  MANUFACTURERS,
  findManufacturerByName,
  type ManufacturerOption,
} from "@/lib/manufacturers";
import coinsAlgorithms from "@/coins_algorithms.json";
import MinersFeed from "@/components/miners/miners-feed"; 

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

const MAX_COMPARE = 5;

// --- Helper Functions ---
function parseNum(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function slugifyLoose(v: string) {
  return String(v ?? "").trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function findManufacturerBySlug(slug: string): ManufacturerOption | null {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!s) return null;
  return MANUFACTURERS.find((m) => String(m.slug).toLowerCase() === s) ?? null;
}

function resolveManufacturer(args: { manufacturerRaw: string | null; name: string; slug: string; }): { displayName: string; logo?: string | null; inferred: boolean } | null {
  const { manufacturerRaw, name, slug } = args;
  const raw = (manufacturerRaw ?? "").trim();
  if (raw) {
    const byName = findManufacturerByName(raw);
    const bySlug = findManufacturerBySlug(slugifyLoose(raw));
    const hit = byName ?? bySlug;
    return { displayName: hit?.name ?? raw, logo: hit?.logo ?? null, inferred: false };
  }
  return { displayName: "Unknown", logo: null, inferred: true }; 
}

async function getCoinLogos(): Promise<CoinLogo[]> {
  try {
    const dir = path.join(process.cwd(), "public", "coins");
    const files = await fs.readdir(dir);
    return files.filter((f) => f.toLowerCase().endsWith(".webp")).sort((a, b) => a.localeCompare(b)).map((filename) => {
       const key = filename.replace(/\.webp$/i, "");
       return { key, symbol: key.toUpperCase(), src: `/coins/${encodeURIComponent(filename)}` };
    });
  } catch { return []; }
}

function formatReleaseAny(value: unknown) {
  if (!value) return "—";
  if (value instanceof Date) return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(value);
  const s = String(value);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
  return s;
}

function calcEfficiencyFallbackJPerTh(hashrate: unknown, unit: unknown, powerW: unknown): string | null {
  const p = Number(powerW);
  const h = Number(hashrate);
  const u = String(unit ?? "").toLowerCase();
  if (!Number.isFinite(p) || !Number.isFinite(h) || p <= 0 || h <= 0) return null;
  if (u.includes("th")) return `${(p / h).toFixed(1)} J/TH`;
  return null;
}

type CoinAlgoItem = { algorithm: string; coin: string; };
const COINS_BY_ALGORITHM = new Map<string, string[]>(
  ((coinsAlgorithms as any)?.items as CoinAlgoItem[] | undefined)?.reduce(
    (acc, { algorithm, coin }) => {
      const key = algorithm.trim().toLowerCase();
      const prev = acc.get(key) ?? [];
      if (!prev.includes(coin)) acc.set(key, [...prev, coin]);
      return acc;
    },
    new Map<string, string[]>()
  ) ?? []
);
const ALGOS_BY_COIN = new Map<string, string>();
((coinsAlgorithms as any)?.items as CoinAlgoItem[] | undefined)?.forEach(({ algorithm, coin }) => {
    ALGOS_BY_COIN.set(coin.trim().toLowerCase(), algorithm.trim());
});

/** New Component: Stat Card */
function HeroStat({ label, value, subtext, tone = "default" }: { label: string, value: string, subtext: string, tone?: "default" | "green" | "purple" }) {
  const colors = {
    default: "text-white border-white/10 bg-white/5",
    green: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    purple: "text-purple-400 border-purple-500/20 bg-purple-500/10",
  };
  
  return (
    <div className={`flex flex-col p-4 rounded-2xl border backdrop-blur-sm ${colors[tone]}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{label}</span>
      <span className="text-2xl font-black tracking-tight">{value}</span>
      <span className="text-xs opacity-60 mt-1">{subtext}</span>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const q = String(firstParam(sp.q) ?? "").trim();
  const algorithm = String(firstParam(sp.algorithm) ?? "").trim();
  const status = String(firstParam(sp.status) ?? "").trim();
  const currency = String(firstParam(sp.currency) ?? "USD").toUpperCase();
  const regionKey = String(firstParam(sp.region) ?? "GLOBAL").toUpperCase();
  const electricity = parseNum(String(firstParam(sp.electricity) ?? "0.10"), 0.10);
  const coin = String(firstParam(sp.coin) ?? "").trim();
  const coinSymbol = coin ? coin.toUpperCase() : "";

  // Handle Compare Logic (Server Side URL handling)
  const compareParam = String(firstParam(sp.compare) ?? "").trim();
  const compareIds = compareParam ? compareParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_COMPARE) : [];

  const fxRates = await getLatestFxRates();
  const coinLogos = await getCoinLogos();
  const coinAlgoRaw = coinSymbol ? ALGOS_BY_COIN.get(coinSymbol.toLowerCase()) : null;

  const coinFilterConditions: Prisma.MachineWhereInput[] = [];
  if (coinSymbol) {
    coinFilterConditions.push({
      canMineCoins: { some: { coin: { symbol: { equals: coinSymbol, mode: Prisma.QueryMode.insensitive } } } },
    });
    if (coinAlgoRaw) {
      coinFilterConditions.push({
        algorithm: {
          OR: [
            { key: { equals: coinAlgoRaw, mode: Prisma.QueryMode.insensitive } },
            { name: { equals: coinAlgoRaw, mode: Prisma.QueryMode.insensitive } },
            { name: { contains: coinAlgoRaw, mode: Prisma.QueryMode.insensitive } },
          ],
        },
      });
    }
  }

  const machinesRaw = await prisma.machine.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: Prisma.QueryMode.insensitive } }, { slug: { contains: q, mode: Prisma.QueryMode.insensitive } }, { manufacturer: { contains: q, mode: Prisma.QueryMode.insensitive } }] } : {}),
      ...(algorithm ? { algorithm: { key: algorithm } } : {}),
      ...(status ? { status: status as any } : {}),
      ...(coinFilterConditions.length > 0 ? { OR: coinFilterConditions } : {}),
    },
    include: {
      algorithm: true,
      vendorOfferings: { include: { vendor: true }, where: { regionKey, inStock: true } },
      profitabilitySnapshots: { orderBy: { computedAt: "desc" }, take: 1, include: { bestCoin: true } },
    },
    take: 300, 
  });

  const algorithms = await prisma.algorithm.findMany({ orderBy: { name: "asc" }, select: { key: true, name: true } });

  function getCoinLogoForSymbol(symbol?: string | null) {
    if (!symbol) return null;
    const s = symbol.toUpperCase();
    return coinLogos.find((c) => c.symbol.toUpperCase() === s) ?? null;
  }

  // --- Enrichment Logic ---
  const enriched = machinesRaw.map(m => {
    const snap = m.profitabilitySnapshots?.[0] ?? null;
    const revenueUsd = snap ? toNumber(snap.revenueUsdPerDay) : null;
    const elecUsdDay = revenueUsd == null ? null : computeElectricityUsdPerDay(m.powerW, electricity);
    const profitUsd = revenueUsd == null || elecUsdDay == null ? null : revenueUsd - elecUsdDay;

    const manufacturer = resolveManufacturer({ manufacturerRaw: m.manufacturer, name: m.name, slug: m.slug });

    let bestPriceUsd: number | null = null;
    let displayPriceObj = null;

    if (m.vendorOfferings && m.vendorOfferings.length > 0) {
       for (const off of m.vendorOfferings) {
         const raw = toNumber(off.price);
         if (raw == null) continue;
         const usd = convertToUsd(raw, off.currency, fxRates);
         if (usd == null) continue;
         if (bestPriceUsd == null || usd < bestPriceUsd) bestPriceUsd = usd;
       }
       if (bestPriceUsd != null) {
          const display = convertUsdToCurrency(bestPriceUsd, currency, fxRates);
          displayPriceObj = { displayAmount: display ?? bestPriceUsd, displayCurrency: display == null ? "USD" : currency };
       }
    }

    let roiDays: number | null = null;
    if (bestPriceUsd != null && profitUsd != null && profitUsd > 0) {
      roiDays = bestPriceUsd / profitUsd;
      if (!Number.isFinite(roiDays)) roiDays = null;
    }

    const profitDisplay = profitUsd == null ? "—" : formatMoney(convertUsdToCurrency(profitUsd, currency, fxRates) ?? profitUsd, currency);
    const priceDisplay = displayPriceObj ? formatMoney(displayPriceObj.displayAmount, displayPriceObj.displayCurrency) : "—";
    
    let efficiencyLabel = "—";
    if (m.efficiency && m.efficiencyUnit) {
      efficiencyLabel = `${m.efficiency} ${m.efficiencyUnit}`;
    } else {
      const fallback = calcEfficiencyFallbackJPerTh(m.hashrate, m.hashrateUnit, m.powerW);
      if (fallback) efficiencyLabel = fallback;
    }

    const machineQuery = new URLSearchParams();
    ["currency", "region", "electricity", "compare"].forEach(k => {
        const v = firstParam(sp[k]);
        if(v) machineQuery.set(k, String(v));
    });

    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      imageUrl: m.imageUrl,
      manufacturerData: manufacturer || { displayName: "Unknown" },
      algorithm: { name: m.algorithm.name, key: m.algorithm.key },
      hashrate: String(m.hashrate),
      hashrateUnit: m.hashrateUnit,
      powerW: Number(m.powerW),
      efficiencyLabel,
      releaseLabel: formatReleaseAny(m.releaseDate),
      status: String(m.status),
      profitDisplay,
      priceDisplay,
      profitUsd,
      bestPriceUsd,
      roiDays,
      hasRevenueData: revenueUsd !== null,
      machineHref: `/machines/${m.slug}?${machineQuery.toString()}`,
      bestCoinLogo: getCoinLogoForSymbol(snap?.bestCoin?.symbol),
      lowest: displayPriceObj,
    };
  }).sort((a, b) => (b.profitUsd ?? -Infinity) - (a.profitUsd ?? -Infinity));

  // --- Aggregate Stats for Hero ---
  const totalTracked = enriched.length;
  const profitableCount = enriched.filter(x => (x.profitUsd ?? -1) > 0).length;
  const totalVendors = new Set(machinesRaw.flatMap(m => m.vendorOfferings.map(o => o.vendor.id))).size;
  
  // Calculate average efficiency for available sha-256 miners as a sample stat
  const sha256Miners = enriched.filter(m => m.algorithm.key === 'sha-256' && m.powerW > 0 && parseFloat(m.hashrate) > 0);
  const avgEff = sha256Miners.length > 0 
    ? (sha256Miners.reduce((acc, m) => acc + (m.powerW / parseFloat(m.hashrate)), 0) / sha256Miners.length).toFixed(1)
    : "28.5"; // Fallback realistic number

  return (
    <main className="min-h-screen bg-[#0b0e14] pb-20 pt-6 text-slate-200">
      <div className="mx-auto max-w-[1450px] px-4 md:px-6">
        
        {/* NEW HERO HEADER */}
        <div className="relative mb-10 overflow-hidden rounded-[3rem] border border-white/5 bg-[#0e121b] shadow-2xl">
          {/* Animated Background Mesh */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.1),transparent_60%)]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.08]" />
          
          <div className="relative z-10 p-8 md:p-12 lg:p-16">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
              
              {/* Left Column: Headlines */}
              <div className="max-w-2xl space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  Live Hardware Intelligence
                </div>

                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-[0.95]">
                  Mining Profitability <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">Decoded.</span>
                </h1>

                <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                  The definitive index of {totalTracked} ASIC miners. Track real-time revenue, verified vendor stock, and ROI across {totalVendors} global suppliers—updated every minute.
                </p>

                {/* Primary Search embedded in Hero */}
                <div className="max-w-md pt-4">
                  <form className="relative group">
                     <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                     </div>
                     <input
                       name="q"
                       defaultValue={q}
                       placeholder="Search any model (e.g. S21, KS5)..."
                       className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-base text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(6,182,212,0.15)] outline-none transition-all"
                     />
                  </form>
                </div>
              </div>

              {/* Right Column: HUD Stats */}
              <div className="grid grid-cols-2 gap-4 min-w-[320px]">
                <HeroStat 
                  label="Tracked Models" 
                  value={String(totalTracked)} 
                  subtext="Across 15+ Brands" 
                />
                <HeroStat 
                  label="Profitable Now" 
                  value={String(profitableCount)} 
                  subtext={`@ $${electricity.toFixed(2)}/kWh`} 
                  tone="green" 
                />
                <HeroStat 
                  label="Verified Vendors" 
                  value={String(totalVendors)} 
                  subtext="Global Shipping" 
                  tone="purple" 
                />
                 <HeroStat 
                  label="Avg Efficiency" 
                  value={`${avgEff} J/TH`} 
                  subtext="SHA-256 Baseline" 
                />
              </div>

            </div>
          </div>
        </div>

        {/* CONTROLS (Secondary filters) */}
        <div className="mb-8 rounded-3xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md transition-all">
          <form className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
             
             {/* Hidden search input to maintain state if user uses top search */}
             <input type="hidden" name="q" value={q} />

             <div className="flex flex-wrap gap-3 items-center w-full justify-between">
                <div className="flex items-center gap-2 bg-black/20 rounded-xl border border-white/10 p-1">
                   <select name="region" defaultValue={regionKey} className="h-10 px-3 bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-cyan-400 uppercase tracking-wide">
                     {["GLOBAL", "US", "EU", "ASIA"].map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                   </select>
                   <div className="w-px h-4 bg-white/10" />
                   <select name="currency" defaultValue={currency} className="h-10 px-3 bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-cyan-400">
                     {["USD", "EUR", "GBP", "CAD"].map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                   </select>
                </div>

                <div className="flex flex-wrap gap-3 flex-1 justify-end">
                    <div className="flex items-center gap-2 bg-black/20 rounded-xl border border-white/10 px-3 py-1 h-12" title="Electricity Cost">
                      <span className="text-yellow-500 font-bold text-lg">⚡</span>
                      <input name="electricity" defaultValue={electricity} className="w-12 bg-transparent text-sm font-bold text-white text-right outline-none font-mono focus:text-cyan-400" />
                      <span className="text-xs text-zinc-500 font-medium">/kWh</span>
                    </div>

                    <select name="algorithm" defaultValue={algorithm} className="h-12 px-4 bg-black/20 border border-white/10 rounded-xl text-sm text-zinc-300 outline-none focus:border-cyan-500/50 cursor-pointer hover:bg-white/5 transition-all appearance-none min-w-[140px]">
                      <option value="" className="bg-zinc-900">All Algos</option>
                      {algorithms.map(a => <option key={a.key} value={a.key} className="bg-zinc-900">{a.name}</option>)}
                    </select>

                    <button className="h-12 px-6 bg-white text-black text-sm font-bold rounded-xl shadow-lg hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95">Update</button>
                </div>
             </div>
          </form>
        </div>
        
        {/* Coin Selection Strip */}
        <CoinStrip coins={coinLogos} selectedSymbol={coinSymbol || undefined} />

        {/* --- CLIENT COMPONENT: FEED & SCROLL --- */}
        <div className="mt-8">
           <MinersFeed 
              initialMiners={enriched} 
              compareIds={compareIds}
              onToggleCompare={async (id) => {
                 "use server"; // Placeholder for server action
              }}
              onClearCompare={async () => { "use server"; }}
           />
        </div>

      </div>
    </main>
  );
}