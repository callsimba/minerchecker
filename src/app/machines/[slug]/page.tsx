// src/app/machines/[slug]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  convertToUsd,
  convertUsdToCurrency,
  formatMoney,
  getLatestFxRates,
  toNumber,
} from "@/server/public";
import { computeElectricityUsdPerDay, parseSpeedToBase } from "@/server/profitability/math";
import { FavoriteButton } from "@/components/favorite-button";
import { VoteButton } from "@/components/vote-button";
import { getCoinsForAlgorithm } from "@/lib/coins-by-algorithm";
import { MachinePageTabs } from "@/components/machine-page-tabs";
import { MarketSentimentCard } from "@/components/market-sentiment-card";
import { ProfitabilityWidget } from "@/components/profitability-widget";
import { CompareTray } from "@/components/compare-tray";
import {
  MANUFACTURERS,
  findManufacturerByName,
  findManufacturerBySlug as findManufacturerBySlugLib,
  normalizeManufacturerKey,
} from "@/lib/manufacturers";
import { getCoinLogoUrl } from "@/lib/coin-logos";

export const dynamic = "force-dynamic";

type ManufacturerRow = (typeof MANUFACTURERS)[number];

function parseNum(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toIsoDate(d?: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

// --- Manufacturer Resolution ---
function findManufacturerBySlug(slug: string): ManufacturerRow | null {
  const direct = findManufacturerBySlugLib(slug);
  if (direct) return direct as any;
  const key = normalizeManufacturerKey(slug);
  if (!key) return null;
  return (
    (MANUFACTURERS.find((m) => normalizeManufacturerKey(m.slug) === key) as any) ??
    (MANUFACTURERS.find((m) => normalizeManufacturerKey(m.name) === key) as any) ??
    null
  );
}

function resolveManufacturer(args: {
  manufacturerRaw: string | null;
  name: string;
  slug: string;
}): { displayName: string; logoUrl?: string | null; inferred: boolean } | null {
  const { manufacturerRaw, name, slug } = args;
  const raw = String(manufacturerRaw ?? "").trim();
  if (raw) {
    const hit =
      (findManufacturerByName(raw) as any) ??
      findManufacturerBySlug(raw) ??
      findManufacturerBySlug(normalizeManufacturerKey(raw));
    return {
      displayName: hit?.name ?? raw,
      logoUrl: (hit as any)?.logo ?? null,
      inferred: false,
    };
  }
  const hay = `${slug} ${name}`.toLowerCase();
  const rules = [
    { re: /\bantminer\b|\bbitmain\b/i, slug: "bitmain" },
    { re: /\bwhatsminer\b|\bmicrobt\b/i, slug: "microbt" },
    { re: /\bavalon\b|\bcanaan\b/i, slug: "canaan" },
    { re: /\biceriver\b/i, slug: "iceriver" },
    { re: /\bgoldshell\b/i, slug: "goldshell" },
    { re: /\bjasminer\b/i, slug: "jasminer" },
    { re: /\bipollo\b/i, slug: "ipollo" },
    { re: /\binnosilicon\b|\binno\b/i, slug: "innosilicon" },
    { re: /\bibelink\b/i, slug: "ibelink" },
    { re: /\bstrongu\b|\bstrong\s*u\b/i, slug: "strongu" },
    { re: /\bdayun\b/i, slug: "dayun" },
    { re: /\bbaikal\b/i, slug: "baikal" },
    { re: /\bauradine\b/i, slug: "auradine" },
    { re: /\bbitdeer\b/i, slug: "bitdeer" },
    { re: /\bbitaxe\b/i, slug: "bitaxe" },
  ];
  for (const r of rules) {
    if (r.re.test(hay)) {
      const hit = findManufacturerBySlug(r.slug);
      return {
        displayName: hit?.name ?? r.slug,
        logoUrl: (hit as any)?.logo ?? null,
        inferred: true,
      };
    }
  }
  return null;
}

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

export default async function MachineDetailPage({
  params,
  searchParams,
}: {
  params: MaybePromise<{ slug: string }>;
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const { slug } = await params;

  const currency = String(sp.currency ?? "USD").toUpperCase();
  const regionKey = String(sp.region ?? "GLOBAL").toUpperCase();
  const electricity = parseNum(String(sp.electricity ?? "0.10"), 0.1);

  const fxRates = await getLatestFxRates();

  const machine = await prisma.machine.findUnique({
    where: { slug },
    include: {
      algorithm: true,
      canMineCoins: { include: { coin: true } },
      vendorOfferings: {
        include: { vendor: true },
        where: { regionKey, inStock: true },
      },
      profitabilitySnapshots: {
        orderBy: { computedAt: "desc" },
        take: 366,
        include: { bestCoin: true },
      },
    },
  });

  if (!machine) return notFound();

  // Similar Machines
  const similarMachines = await prisma.machine.findMany({
    where: {
      algorithmId: machine.algorithmId,
      id: { not: machine.id },
      status: "AVAILABLE",
    },
    orderBy: { hashrate: "desc" },
    take: 4,
    include: {
      vendorOfferings: { where: { inStock: true }, select: { price: true, currency: true } },
    },
  });

  const manufacturer = resolveManufacturer({
    manufacturerRaw: machine.manufacturer,
    name: machine.name,
    slug: machine.slug,
  });

  const snaps = machine.profitabilitySnapshots ?? [];
  const currentSnap = snaps[0] ?? null;
  const history = [...snaps].reverse().map((s) => toNumber(s.profitUsdPerDay) ?? 0);

  const revenueUsd = currentSnap ? toNumber((currentSnap as any).revenueUsdPerDay) : null;
  const elecCostUsd = computeElectricityUsdPerDay(machine.powerW, electricity);
  const profitUsd = revenueUsd == null ? null : revenueUsd - elecCostUsd;

  const speed = parseSpeedToBase(String(machine.hashrate), String(machine.hashrateUnit));

  const jPerTh =
    speed && speed.baseUnit === "H/s" && speed.value > 0 ? (machine.powerW * 1e12) / speed.value : null;

  // Efficiency Ranking
  const peers = await prisma.machine.findMany({
    where: { algorithmId: machine.algorithmId },
    select: { id: true, hashrate: true, hashrateUnit: true, powerW: true },
  });

  const peerEfficiencies = peers
    .map((p) => {
      const s = parseSpeedToBase(p.hashrate, p.hashrateUnit);
      if (!s || s.baseUnit !== "H/s" || s.value === 0) return null;
      return (p.powerW * 1e12) / s.value;
    })
    .filter((e) => e !== null) as number[];

  peerEfficiencies.sort((a, b) => a - b);

  let percentile = 0;
  if (jPerTh && peerEfficiencies.length > 0) {
    const worseCount = peerEfficiencies.filter((e) => e > jPerTh).length;
    percentile = Math.round((worseCount / peerEfficiencies.length) * 100);
  }

  // Vendor Offers
  const offersWithUsd = machine.vendorOfferings
    .map((o) => {
      const raw = toNumber(o.price);
      if (raw == null) return null;
      const usd = convertToUsd(raw, o.currency, fxRates);
      if (usd == null) return null;

      const oAny = o as any;
      const shippingRaw = oAny.shippingCost ? toNumber(oAny.shippingCost) : 0;
      const shippingUsd = shippingRaw != null ? (convertToUsd(shippingRaw, o.currency, fxRates) ?? 0) : 0;

      const totalUsd = usd + shippingUsd;

      return {
        ...o,
        usdRaw: usd,
        rawPrice: raw,
        totalUsd,
        shippingUsd,
        warrantyMonths: oAny.warrantyMonths,
        psuIncluded: oAny.psuIncluded,
        vendor: o.vendor,
      };
    })
    .filter(Boolean) as any[];

  offersWithUsd.sort((a, b) => a.totalUsd - b.totalUsd);

  const bestOffer = offersWithUsd[0] || null;
  const topVendors = offersWithUsd.slice(0, 3);

  const priceMin = offersWithUsd.length ? offersWithUsd[0].usdRaw : 0;
  const priceMax = offersWithUsd.length ? offersWithUsd[offersWithUsd.length - 1].usdRaw : 0;
  const priceSpread = priceMax - priceMin;

  // Coins (✅ resolve logo from /public helper, not DB field)
  const algoCoinsRaw = getCoinsForAlgorithm(machine.algorithm.name) ?? [];
  const algoSymbols = (Array.isArray(algoCoinsRaw) ? algoCoinsRaw : [])
    .map((x) => (typeof x === "string" ? x.trim().toUpperCase() : null))
    .filter(Boolean) as string[];

  const dbSymbols = machine.canMineCoins
    .map((c: any) => String(c.coin.symbol ?? "").trim().toUpperCase())
    .filter(Boolean) as string[];

  const allSymbols = Array.from(new Set([...algoSymbols, ...dbSymbols]));
  const coinsForUi = allSymbols.map((symbol) => ({ symbol, logoUrl: getCoinLogoUrl(symbol) }));

  const compareRaw = Array.isArray(sp.compare) ? sp.compare[0] : (sp.compare as any);
  const compareIds = String(compareRaw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const isCompared = compareIds.includes(machine.id);
  const compareHref = `/?compare=${
    isCompared
      ? compareIds.filter((id) => id !== machine.id).join(",")
      : [...compareIds, machine.id].slice(0, 5).join(",")
  }`;

  // ✅ NEW: pass DB snapshot fields into the widget (without changing layout)
  const widgetSnapshotFields = {
    bestCoin: (currentSnap as any)?.bestCoin ?? null,
    bestCoinConfidence: (currentSnap as any)?.bestCoinConfidence ?? null,
    bestCoinReason: (currentSnap as any)?.bestCoinReason ?? null,
    breakdown: (currentSnap as any)?.breakdown ?? null,
  };

  return (
    <main className="mx-auto max-w-[1200px] pb-20 pt-6 px-4 md:px-6 text-slate-200">
      <nav className="flex items-center justify-between mb-8 text-sm">
        <div className="flex items-center gap-2 text-slate-500">
          <Link href="/" className="hover:text-orange-400 transition-colors">
            Miners
          </Link>
          <span>/</span>
          <span className="text-white font-medium">{machine.slug}</span>
        </div>
        <div className="flex items-center gap-3">
          <VoteButton machineId={machine.id} />
          <FavoriteButton machineId={machine.id} />
          <Link
            href={compareHref}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
              isCompared
                ? "bg-orange-500/10 border-orange-500/50 text-orange-400"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            {isCompared ? "Compared" : "Compare"}
          </Link>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-5 space-y-6">
          {/* Main Info Card */}
          <div className="relative bg-[#151a2a] border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-red-500 to-purple-500 opacity-50" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{machine.name}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                  {manufacturer?.logoUrl && (
                    <Image src={manufacturer.logoUrl} alt="logo" width={16} height={16} className="rounded-sm opacity-80" />
                  )}
                  <span>{manufacturer?.displayName ?? "—"}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Release</div>
                <div className="text-white font-medium">{toIsoDate(machine.releaseDate)}</div>
              </div>
            </div>

            <div className="relative h-[280px] w-full flex items-center justify-center my-8">
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-blue-500/5 rounded-full blur-3xl" />
              {(machine as any).imageUrl ? (
                <img
                  src={(machine as any).imageUrl}
                  alt={machine.name}
                  className="relative z-10 h-full w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="text-6xl opacity-20">🧊</div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-6">
              <div className="text-center">
                <div className="text-orange-400 font-bold text-lg">
                  {machine.hashrate} <span className="text-xs text-orange-400/70">{machine.hashrateUnit}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">Hashrate</div>
              </div>
              <div className="text-center border-l border-slate-800">
                <div className="text-red-400 font-bold text-lg">
                  {machine.powerW}
                  <span className="text-xs text-red-400/70">W</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">Power</div>
              </div>
              <div className="text-center border-l border-slate-800">
                <div className="text-emerald-400 font-bold text-lg">
                  {jPerTh ? jPerTh.toFixed(2) : "-"}
                  <span className="text-xs text-emerald-400/70">J/TH</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">Eff</div>
              </div>
            </div>
          </div>

          {/* Efficiency Rank */}
          {jPerTh && (
            <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs uppercase font-bold text-slate-500">Efficiency Rank</div>
                <div className="text-xs text-slate-400">vs {peers.length} peers</div>
              </div>
              <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 to-emerald-500 w-full opacity-30" />
                <div className="absolute top-0 h-full w-1 bg-white shadow-[0_0_10px_white]" style={{ left: `${percentile}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs font-bold">
                <span className="text-slate-500">Less Efficient</span>
                <span className="text-emerald-400">Better than {percentile}%</span>
                <span className="text-slate-500">More Efficient</span>
              </div>
            </div>
          )}

          <MarketSentimentCard machineId={machine.id} isProfit={profitUsd !== null ? profitUsd > 0 : null} />
        </div>

        <div className="lg:col-span-7 space-y-6">
          <ProfitabilityWidget
            {...({
              history,
              baseRevenue: revenueUsd,
              baseElec: elecCostUsd,
              electricityRate: electricity,
              regionKey,
              bestPrice: bestOffer?.usdRaw ?? null,
              bestVendor: bestOffer?.vendor?.name ?? null,
              bestUrl: bestOffer?.productUrl ?? null,
              powerW: machine.powerW,
              updatedAt: currentSnap?.computedAt ?? new Date(),
              ...widgetSnapshotFields,
            } as any)}
          />

          {offersWithUsd.length > 1 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#151a2a] border border-slate-800 p-4 rounded-2xl text-center">
                <div className="text-xs text-slate-500 uppercase font-bold">Lowest</div>
                <div className="text-emerald-400 font-bold text-lg">${formatMoney(priceMin, "USD")}</div>
              </div>
              <div className="bg-[#151a2a] border border-slate-800 p-4 rounded-2xl text-center">
                <div className="text-xs text-slate-500 uppercase font-bold">Average</div>
                <div className="text-white font-bold text-lg">${formatMoney((priceMin + priceMax) / 2, "USD")}</div>
              </div>
              <div className="bg-[#151a2a] border border-slate-800 p-4 rounded-2xl text-center">
                <div className="text-xs text-slate-500 uppercase font-bold">Spread</div>
                <div className="text-amber-400 font-bold text-lg">${formatMoney(priceSpread, "USD")}</div>
              </div>
            </div>
          )}

          {/* Top 3 Deals Box */}
          <div className="bg-[#151a2a] border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span>⚡</span> Top Deals
              </h3>
              {topVendors.length > 0 && (
                <a href="#all-vendors" className="text-xs text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider">
                  View All ({offersWithUsd.length}) &darr;
                </a>
              )}
            </div>
            {topVendors.length === 0 ? (
              <div className="text-slate-500 text-sm italic">No offers currently available.</div>
            ) : (
              <div className="space-y-3">
                {topVendors.map((o, idx) => {
                  const display = convertUsdToCurrency(o.usdRaw, currency, fxRates) ?? o.usdRaw;
                  return (
                    <div key={o.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">#{idx + 1}</div>
                        <div>
                          <div className="font-bold text-white text-sm">{o.vendor?.name}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{o.regionKey}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold text-white">{formatMoney(display, currency)}</div>
                        </div>
                        <a
                          href={o.productUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          Buy
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <MachinePageTabs
        description={
          <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-6 text-slate-400 leading-relaxed text-sm">
            <h3 className="text-white font-bold text-lg mb-4">About {machine.name}</h3>
            <p>
              The {machine.name} is an ASIC miner manufactured by {manufacturer?.displayName ?? "—"}. Released{" "}
              {toIsoDate(machine.releaseDate)}. Mines {machine.algorithm.name} with {machine.hashrate} {machine.hashrateUnit} at{" "}
              {machine.powerW}W.
            </p>
          </div>
        }
        specs={
          <div className="bg-[#151a2a] border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <tbody className="divide-y divide-slate-800">
                <tr className="hover:bg-slate-800/20">
                  <td className="p-4 text-slate-500">Manufacturer</td>
                  <td className="p-4 text-white font-medium">{manufacturer?.displayName ?? "—"}</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="p-4 text-slate-500">Hashrate</td>
                  <td className="p-4 text-white font-medium">
                    {machine.hashrate} {machine.hashrateUnit}
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="p-4 text-slate-500">Power</td>
                  <td className="p-4 text-white font-medium">{machine.powerW} W</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="p-4 text-slate-500">Efficiency</td>
                  <td className="p-4 text-white font-medium">{jPerTh ? jPerTh.toFixed(2) : "-"} J/TH</td>
                </tr>
              </tbody>
            </table>
          </div>
        }
        coins={
          <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-wrap gap-3">
              {coinsForUi.map((c) => (
                <div
                  key={c.symbol}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-orange-500/30 transition-colors"
                >
                  {c.logoUrl ? (
                    <Image src={c.logoUrl} alt={c.symbol} width={28} height={28} className="rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-xs">
                      {c.symbol.slice(0, 2)}
                    </div>
                  )}
                  <span className="text-white font-medium">{c.symbol}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* --- Full Vendor List (Revamped Layout) --- */}
      <div id="all-vendors" className="mt-12 bg-[#151a2a] border border-slate-800 rounded-3xl p-6 shadow-xl scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-slate-800 pb-4">
          <h3 className="text-white font-bold text-lg">Full Vendor List</h3>
          <div className="text-xs text-slate-500">Sorted by total cost (Price + Shipping)</div>
        </div>

        {/* Header Row */}
        <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-4">
          <div className="col-span-3">Vendor</div>
          <div className="col-span-2">Region</div>
          <div className="col-span-1">Stock</div>
          <div className="col-span-1 text-center">ROI</div>
          <div className="col-span-2 text-center">Specs</div>
          <div className="col-span-3 text-right">Total Price</div>
        </div>

        {offersWithUsd.length === 0 ? (
          <div className="text-slate-500 italic text-center py-10">No vendor listings found.</div>
        ) : (
          <div className="space-y-3">
            {offersWithUsd.map((o) => {
              const displayPrice = convertUsdToCurrency(o.usdRaw, currency, fxRates) ?? o.usdRaw;
              const displayShipping = o.shippingUsd > 0 ? convertUsdToCurrency(o.shippingUsd, currency, fxRates) : 0;

              const specificROI = profitUsd && profitUsd > 0 ? o.totalUsd / profitUsd : null;
              const roiLabel = specificROI ? (specificROI > 3650 ? "> 10 Yrs" : `${Math.ceil(specificROI)} Days`) : "N/A";

              return (
                <div
                  key={o.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-slate-900/40 border border-slate-800 rounded-xl hover:bg-slate-800/60 hover:border-slate-700 transition-all group relative overflow-hidden"
                >
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 border border-slate-700 overflow-hidden shrink-0">
                      {(o.vendor as any)?.logoUrl ? (
                        <Image src={(o.vendor as any).logoUrl} alt={o.vendor.name} width={40} height={40} className="w-full h-full object-cover" />
                      ) : (
                        o.vendor?.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        {o.vendor?.name}
                        {o.vendor?.isVerified && (
                          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {o.vendor?.trustLevel !== "UNKNOWN" && (
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              o.vendor?.trustLevel === "HIGH"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : o.vendor?.trustLevel === "MEDIUM"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {o.vendor?.trustLevel} TRUST
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm text-white font-medium flex items-center gap-2">
                      <span>{o.regionKey === "GLOBAL" ? "🌍" : o.regionKey === "US" ? "🇺🇸" : o.regionKey === "EU" ? "🇪🇺" : "🏳️"}</span>
                      <span className="truncate">{(o.vendor as any)?.country || o.regionKey}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Ships from {o.regionKey}</div>
                  </div>

                  <div className="col-span-1">
                    {o.inStock ? (
                      <div className="flex flex-col">
                        <span className="text-emerald-400 font-bold text-xs">In Stock</span>
                        <span className="text-[10px] text-slate-500">Ready to ship</span>
                      </div>
                    ) : (
                      <span className="text-red-400 font-bold text-xs">Out of Stock</span>
                    )}
                  </div>

                  <div className="col-span-1 text-center">
                    <span className="bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md text-[11px] font-bold border border-yellow-500/20 whitespace-nowrap">
                      {roiLabel}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-center gap-3">
                    <div className="flex flex-col items-center text-center" title="Warranty">
                      <span className="text-lg">🛡️</span>
                      <span className="text-[10px] text-slate-400">{o.warrantyMonths ? `${o.warrantyMonths}m` : "-"}</span>
                    </div>
                    <div className="flex flex-col items-center text-center" title="Power Supply">
                      <span className={`text-lg ${o.psuIncluded ? "text-white" : "opacity-30 grayscale"}`}>🔌</span>
                      <span className="text-[10px] text-slate-400">{o.psuIncluded ? "Yes" : "No"}</span>
                    </div>
                  </div>

                  <div className="col-span-3 flex items-center justify-end gap-4">
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">{formatMoney(displayPrice, currency)}</div>
                      <div className="text-[10px] text-slate-400 flex flex-col items-end">
                        {o.shippingUsd > 0 ? <span>+ {formatMoney(displayShipping ?? 0, currency)} ship</span> : <span className="text-emerald-400 font-bold">Free Shipping</span>}
                      </div>
                    </div>
                    <a
                      href={o.productUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="h-10 px-5 flex items-center justify-center bg-white text-black hover:bg-slate-200 font-bold rounded-xl transition-colors shadow-lg whitespace-nowrap"
                    >
                      View Offer
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Similar Machines */}
      {similarMachines.length > 0 && (
        <section className="mt-16 border-t border-slate-800 pt-10">
          <h2 className="text-xl font-bold text-white mb-6">Similar Alternatives</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {similarMachines.map((sim) => {
              const prices = sim.vendorOfferings.map((o) => toNumber(o.price)).filter(Boolean) as number[];
              const minPrice = prices.length ? Math.min(...prices) : null;
              return (
                <Link
                  key={sim.id}
                  href={`/machines/${sim.slug}`}
                  className="group block bg-[#151a2a] border border-slate-800 rounded-2xl p-4 hover:border-orange-500/50 transition-all"
                >
                  <div className="h-32 w-full bg-slate-900/50 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative">
                    {(sim as any).imageUrl ? (
                      <img src={(sim as any).imageUrl} alt={sim.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <span className="text-2xl opacity-20">🧊</span>
                    )}
                  </div>
                  <h3 className="font-bold text-white truncate group-hover:text-orange-400 transition-colors">{sim.name}</h3>
                  <div className="flex justify-between items-end mt-2">
                    <div className="text-xs text-slate-500">
                      <div>
                        {sim.hashrate} {sim.hashrateUnit}
                      </div>
                      <div>{sim.powerW}W</div>
                    </div>
                    {minPrice && <div className="text-sm font-bold text-white">${minPrice}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <CompareTray />
    </main>
  );
}
