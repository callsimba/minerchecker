import Link from "next/link";
import Image from "next/image";
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

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

const MAX_COMPARE = 5;

// --- Data Helpers ---

type CoinAlgoItem = {
  algorithm: string;
  coin: string;
};

// Map Algorithm (lowercase) -> [Coin Symbols]
const COINS_BY_ALGORITHM = new Map<string, string[]>(
  ((coinsAlgorithms as any)?.items as CoinAlgoItem[] | undefined)?.reduce(
    (acc, { algorithm, coin }) => {
      const key = algorithm.trim().toLowerCase();
      const prev = acc.get(key) ?? [];
      if (!prev.includes(coin)) {
        acc.set(key, [...prev, coin]);
      }
      return acc;
    },
    new Map<string, string[]>()
  ) ?? []
);

// Map Coin (lowercase) -> Algorithm (original string)
const ALGOS_BY_COIN = new Map<string, string>();
((coinsAlgorithms as any)?.items as CoinAlgoItem[] | undefined)?.forEach(
  ({ algorithm, coin }) => {
    ALGOS_BY_COIN.set(coin.trim().toLowerCase(), algorithm.trim());
  }
);

function getCoinsForAlgorithmName(name: string): string[] {
  return COINS_BY_ALGORITHM.get(name.trim().toLowerCase()) ?? [];
}

function parseNum(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function buildHref(
  sp: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>
) {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(sp)) {
    const v = firstParam(val);
    if (v == null || v === "") continue;
    p.set(k, String(v));
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

/**
 * ✅ NEW: Build machine page URL while preserving key “settings” params
 * (so the machine page matches what the user was browsing with)
 */
function buildMachineHref(
  sp: Record<string, string | string[] | undefined>,
  slug: string
) {
  const p = new URLSearchParams();
  const keepKeys = ["currency", "region", "electricity", "compare"];

  for (const k of keepKeys) {
    const v = firstParam(sp[k]);
    if (v != null && v !== "") p.set(k, String(v));
  }

  const qs = p.toString();
  return qs ? `/machines/${slug}?${qs}` : `/machines/${slug}`;
}

/**
 * ✅ NEW: Build compare page URL
 */
function buildCompareHref(
  sp: Record<string, string | string[] | undefined>,
  ids: string[]
) {
  const p = new URLSearchParams();

  // required for compare page
  p.set("ids", ids.join(","));

  // preserve browsing settings
  const keepKeys = ["currency", "region", "electricity"];
  for (const k of keepKeys) {
    const v = firstParam(sp[k]);
    if (v != null && v !== "") p.set(k, String(v));
  }

  return `/compare?${p.toString()}`;
}

function slugifyLoose(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findManufacturerBySlug(slug: string): ManufacturerOption | null {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!s) return null;
  return MANUFACTURERS.find((m) => String(m.slug).toLowerCase() === s) ?? null;
}

function resolveManufacturer(args: {
  manufacturerRaw: string | null;
  name: string;
  slug: string;
}): { displayName: string; logo?: string | null; inferred: boolean } | null {
  const { manufacturerRaw, name, slug } = args;

  const raw = (manufacturerRaw ?? "").trim();
  if (raw) {
    const byName = findManufacturerByName(raw);
    const bySlug = findManufacturerBySlug(slugifyLoose(raw));
    const hit = byName ?? bySlug;

    return {
      displayName: hit?.name ?? raw,
      logo: hit?.logo ?? null,
      inferred: false,
    };
  }

  const hay = `${slug} ${name}`.toLowerCase();

  const rules: Array<{ re: RegExp; slug: string }> = [
    { re: /\bantminer\b|\bbitmain\b/i, slug: "bitmain" },
    { re: /\bwhatsminer\b|\bmicrobt\b/i, slug: "microbt" },
    { re: /\bavalon\b|\bcanaan\b/i, slug: "canaan" },
    { re: /\biceriver\b/i, slug: "iceriver" },
    { re: /\bgoldshell\b/i, slug: "goldshell" },
    { re: /\bjasminer\b/i, slug: "jasminer" },
    { re: /\bipollo\b/i, slug: "ipollo" },
    { re: /\binnosilicon\b|\binno\b/i, slug: "innosilicon" },
    { re: /\bibelink\b/i, slug: "ibelink" },
    { re: /\bstrongu\b/i, slug: "strongu" },
    { re: /\bdayun\b/i, slug: "dayun" },
    { re: /\bbaikal\b/i, slug: "baikal" },
    { re: /\bauradine\b/i, slug: "auradine" },
    { re: /\bbitdeer\b/i, slug: "bitdeer" },
    { re: /\bbitaxe\b/i, slug: "bitaxe" },
  ];

  for (const r of rules) {
    if (r.re.test(hay)) {
      const hit = findManufacturerBySlug(r.slug);
      if (hit) {
        return { displayName: hit.name, logo: hit.logo ?? null, inferred: true };
      }
      return {
        displayName: r.slug.replace(/(^|[-_])\w/g, (m) =>
          m.replace(/[-_]/, "").toUpperCase()
        ),
        logo: null,
        inferred: true,
      };
    }
  }

  return null;
}

async function getCoinLogos(): Promise<CoinLogo[]> {
  try {
    const dir = path.join(process.cwd(), "public", "coins");
    const files = await fs.readdir(dir);

    return files
      .filter((f) => f.toLowerCase().endsWith(".webp"))
      .sort((a, b) => a.localeCompare(b))
      .map((filename) => {
        const key = filename.replace(/\.webp$/i, "");
        const symbol = key.toUpperCase();
        const src = `/coins/${encodeURIComponent(filename)}`;
        return { key, symbol, src };
      });
  } catch {
    return [];
  }
}

function formatReleaseAny(value: unknown) {
  if (!value) return "—";
  if (value instanceof Date) {
    try {
      return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(value);
    } catch {
      return value.toISOString().slice(0, 10);
    }
  }
  const s = String(value);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    try {
      return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }
  return s;
}

/** ✅ NEW: Safer efficiency fallback calculation */
function calcEfficiencyFallbackJPerTh(hashrate: unknown, unit: unknown, powerW: unknown): string | null {
  const p = Number(powerW);
  const h = Number(hashrate);
  const u = String(unit ?? "").toLowerCase();

  if (!Number.isFinite(p) || !Number.isFinite(h) || p <= 0 || h <= 0) return null;

  // Only compute J/TH for TH-based hashrate
  // Accept common variants like "TH/s", "THS", "TH", etc.
  if (u.includes("th")) {
    const jPerTh = p / h;
    if (!Number.isFinite(jPerTh)) return null;
    return `${jPerTh.toFixed(1)} J/TH`;
  }

  return null;
}

// --- Main Page Component ---

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

  const viewRaw = String(firstParam(sp.view) ?? "list").toLowerCase();
  const view: "list" | "grid" = viewRaw === "grid" ? "grid" : "list";

  const compareParam = String(firstParam(sp.compare) ?? "").trim();
  const compareIds = compareParam
    ? compareParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_COMPARE)
    : [];
  const compareSet = new Set(compareIds);

  const fxRates = await getLatestFxRates();
  const coinLogos = await getCoinLogos();

  const coinAlgoRaw = coinSymbol ? ALGOS_BY_COIN.get(coinSymbol.toLowerCase()) : null;

  const coinFilterConditions: Prisma.MachineWhereInput[] = [];

  if (coinSymbol) {
    coinFilterConditions.push({
      canMineCoins: {
        some: {
          coin: { symbol: { equals: coinSymbol, mode: Prisma.QueryMode.insensitive } },
        },
      },
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
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { manufacturer: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
      ...(algorithm ? { algorithm: { key: algorithm } } : {}),
      ...(status ? { status: status as any } : {}),
      ...(coinFilterConditions.length > 0 ? { OR: coinFilterConditions } : {}),
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
    take: 200,
  });

  type MachineWithRelations = typeof machinesRaw[number];

  const machines = machinesRaw as Array<
    MachineWithRelations & {
      imageUrl?: string | null;
      releaseDate?: Date | string | null;
      releasedAt?: Date | string | null;
      release?: Date | string | null;
      releaseAt?: Date | string | null;
      efficiency?: number | string | null;
      efficiencyUnit?: string | null;
    }
  >;

  const algorithms = await prisma.algorithm.findMany({
    orderBy: { name: "asc" },
    select: { key: true, name: true },
  });

  function getCoinLogoForSymbol(symbol?: string | null) {
    if (!symbol) return null;
    const s = symbol.toUpperCase();
    return coinLogos.find((c) => c.symbol.toUpperCase() === s) ?? null;
  }

  function getLowestPrice(offerings: any[]) {
    if (!offerings || offerings.length === 0) return null;

    let bestUsd: number | null = null;
    for (const off of offerings) {
      const raw = toNumber(off.price);
      if (raw == null) continue;

      const usd = convertToUsd(raw, off.currency, fxRates);
      if (usd == null) continue;

      if (bestUsd == null || usd < bestUsd) bestUsd = usd;
    }
    if (bestUsd == null) return null;

    const display = convertUsdToCurrency(bestUsd, currency, fxRates);
    return {
      usd: bestUsd,
      displayAmount: display ?? bestUsd,
      displayCurrency: display == null ? "USD" : currency,
    };
  }

  function enrichOne(m: (typeof machines)[number]) {
    const snap = m.profitabilitySnapshots?.[0] ?? null;
    const revenueUsd = snap ? toNumber(snap.revenueUsdPerDay) : null;

    const elecUsdDay =
      revenueUsd == null ? null : computeElectricityUsdPerDay(m.powerW, electricity);

    const profitUsd =
      revenueUsd == null || elecUsdDay == null ? null : revenueUsd - elecUsdDay;

    const manufacturer = resolveManufacturer({
      manufacturerRaw: m.manufacturer,
      name: m.name,
      slug: m.slug,
    });

    const lowest = getLowestPrice(m.vendorOfferings ?? []);

    let roiDays: number | null = null;
    if (lowest?.usd != null && profitUsd != null && profitUsd > 0) {
      roiDays = lowest.usd / profitUsd;
      if (!Number.isFinite(roiDays)) roiDays = null;
    }

    const profitDisplay =
      profitUsd == null
        ? "—"
        : formatMoney(
            convertUsdToCurrency(profitUsd, currency, fxRates) ?? profitUsd,
            currency
          );

    const revenueDisplay =
      revenueUsd == null
        ? "—"
        : formatMoney(
            convertUsdToCurrency(revenueUsd, currency, fxRates) ?? revenueUsd,
            currency
          );

    const lossLevel =
      profitUsd == null
        ? "none"
        : profitUsd >= 0
          ? "profit"
          : profitUsd <= -10
            ? "severe"
            : profitUsd <= -5
              ? "medium"
              : "mild";

    const bestCoinSymbol = snap?.bestCoin?.symbol ?? null;
    const bestCoinLogo = getCoinLogoForSymbol(bestCoinSymbol);

    const releaseAny =
      (m as any).releaseDate ??
      (m as any).releasedAt ??
      (m as any).releaseAt ??
      (m as any).release ??
      null;

    return {
      m,
      snap,
      revenueUsd,
      profitUsd,
      manufacturer,
      lowest,
      roiDays,
      profitDisplay,
      revenueDisplay,
      lossLevel,
      bestCoinSymbol,
      bestCoinLogo,
      releaseAny,
    };
  }

  const enriched = machines
    .map(enrichOne)
    .sort((a, b) => (b.profitUsd ?? -Infinity) - (a.profitUsd ?? -Infinity));

  // Handle Compare Logic
  const compareRows =
    compareIds.length === 0
      ? []
      : await (async () => {
          const have = new Map(enriched.map((r) => [r.m.id, r]));
          const missing = compareIds.filter((id) => !have.has(id));

          let fetched: typeof machines = [];
          if (missing.length) {
            const fetchedRaw = await prisma.machine.findMany({
              where: { id: { in: missing } },
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
            });
            fetched = fetchedRaw as any;
          }

          const combined = [
            ...compareIds.map((id) => have.get(id)).filter(Boolean),
            ...fetched.map((m) => enrichOne(m as any)),
          ] as ReturnType<typeof enrichOne>[];

          const byId = new Map(combined.map((r) => [r.m.id, r]));
          return compareIds.map((id) => byId.get(id)).filter(Boolean) as ReturnType<
            typeof enrichOne
          >[];
        })();

  const hrefList = buildHref(sp, { view: "list" });
  const hrefGrid = buildHref(sp, { view: "grid" });
  const hrefReset = "/";
  const hrefClearCompare = buildHref(sp, { compare: undefined });

  function toggleCompareHref(id: string) {
    const current = [...compareIds];
    const has = compareSet.has(id);

    if (has) {
      const next = current.filter((x) => x !== id);
      return buildHref(sp, { compare: next.length ? next.join(",") : undefined });
    }

    if (current.length >= MAX_COMPARE) return buildHref(sp, {});
    const next = [...current, id];
    return buildHref(sp, { compare: next.join(",") });
  }

  function removeCompareHref(id: string) {
    const next = compareIds.filter((x) => x !== id);
    return buildHref(sp, { compare: next.length ? next.join(",") : undefined });
  }

  return (
    <main className="min-h-screen bg-[#0b0e14] pb-20 pt-6 text-slate-200">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        {/* --- Top Header & Filters --- */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[#151a2a] p-6 shadow-2xl">
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

          <div className="relative z-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Hardware Index</h1>
                <p className="mt-1 text-sm text-slate-400">
                  {enriched.length} ASIC miners tracked • Real-time profitability • Verified vendors
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2 bg-[#0b0e14] p-1 rounded-xl border border-slate-800">
                <Link
                  href={hrefList}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    view === "list"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <span className="text-lg">☰</span> List
                </Link>
                <Link
                  href={hrefGrid}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    view === "grid"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <span className="text-lg">▦</span> Grid
                </Link>
              </div>
            </div>

            {/* Filter Bar */}
            <form className="mt-6 flex flex-wrap gap-3" method="get">
              <input type="hidden" name="view" value={view} />
              {coinSymbol ? <input type="hidden" name="coin" value={coinSymbol} /> : null}
              {compareIds.length ? (
                <input type="hidden" name="compare" value={compareIds.join(",")} />
              ) : null}

              <div className="flex-1 min-w-[200px]">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                    🔍
                  </div>
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder="Search model, manufacturer..."
                    className="w-full h-11 pl-10 pr-4 bg-[#0b0e14] rounded-xl border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:border-orange-500/50 outline-none transition-colors"
                  />
                </div>
              </div>

              <select
                name="algorithm"
                defaultValue={algorithm}
                className="h-11 px-4 bg-[#0b0e14] rounded-xl border border-slate-800 text-sm text-slate-300 outline-none focus:border-orange-500/50 cursor-pointer appearance-none min-w-[160px]"
              >
                <option value="">All Algorithms</option>
                {algorithms.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </select>

              <select
                name="status"
                defaultValue={status}
                className="h-11 px-4 bg-[#0b0e14] rounded-xl border border-slate-800 text-sm text-slate-300 outline-none focus:border-orange-500/50 cursor-pointer appearance-none min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="AVAILABLE">Available</option>
                <option value="COMING_SOON">Coming Soon</option>
                <option value="DISCONTINUED">Discontinued</option>
              </select>

              <div className="relative group min-w-[140px]">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 text-xs">
                  ⚡
                </div>
                <input
                  name="electricity"
                  defaultValue={String(electricity)}
                  inputMode="decimal"
                  placeholder="Rate"
                  className="w-full h-11 pl-8 pr-12 bg-[#0b0e14] rounded-xl border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:border-orange-500/50 outline-none transition-colors"
                />
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-600 text-xs font-bold">
                  /kWh
                </div>
              </div>

              <button className="h-11 px-6 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-colors shadow-lg shadow-white/5">
                Update
              </button>

              <Link
                href={hrefReset}
                className="h-11 px-4 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                title="Reset Filters"
              >
                ↺
              </Link>
            </form>
          </div>
        </div>

        <CoinStrip coins={coinLogos} selectedSymbol={coinSymbol || undefined} />

        {/* --- Compare Dock --- */}
        {compareRows.length > 0 && (
          <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="bg-orange-500/10 text-orange-400 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border border-orange-500/20">
                Comparing {compareRows.length}
              </span>
              <div className="flex flex-wrap gap-2">
                {compareRows.map((row) => (
                  <Link
                    key={row.m.id}
                    href={removeCompareHref(row.m.id)}
                    className="flex items-center gap-2 bg-[#0b0e14] border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:border-red-500/50 hover:text-red-400 transition-colors group"
                  >
                    {row.m.name}
                    <span className="text-slate-600 group-hover:text-red-500">×</span>
                  </Link>
                ))}
              </div>
            </div>
            <Link href={hrefClearCompare} className="text-xs text-slate-500 hover:text-white transition-colors">
              Clear All
            </Link>
          </div>
        )}

        {compareIds.length >= 2 && (
          <div className="sticky bottom-4 z-50 mt-6 flex justify-end">
            <Link
              href={buildCompareHref(sp, compareIds)}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-black text-black shadow-2xl shadow-orange-500/20 hover:bg-orange-400 transition-colors"
              title="Compare selected miners"
            >
              🆚 Compare ({compareIds.length})
              <span className="text-black/70 font-bold">→</span>
            </Link>
          </div>
        )}

        {/* --- LIST VIEW --- */}
        {view === "list" ? (
          <section className="space-y-2">
            {/* Header */}
            <div className="hidden xl:grid grid-cols-[80px_3fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div>Compare</div>
              <div>Model</div>
              <div>Stats</div>
              <div>Power</div>
              <div>Efficiency</div>
              <div>Algo</div>
              <div>Coins</div>
              <div className="text-right">Price</div>
              <div className="text-right">Profit/Day</div>
            </div>

            {enriched.map((row) => {
              const m = row.m;
              const isSelected = compareSet.has(m.id);
              const profitColor = row.profitUsd && row.profitUsd > 0 ? "text-emerald-400" : "text-red-400";
              const roiText = row.roiDays ? `${Math.ceil(row.roiDays)}d ROI` : "No ROI";
              const releaseLabel = formatReleaseAny(row.releaseAny);

              // ✅ Efficiency Logic: Prefer DB -> Fallback calc
              let efficiencyLabel = "—";
              if ((m as any).efficiency && (m as any).efficiencyUnit) {
                efficiencyLabel = `${(m as any).efficiency} ${(m as any).efficiencyUnit}`;
              } else {
                const fallback = calcEfficiencyFallbackJPerTh(m.hashrate, m.hashrateUnit, m.powerW);
                if (fallback) efficiencyLabel = fallback;
              }

              const machineHref = buildMachineHref(sp, m.slug);

              return (
                <div
                  key={m.id}
                  className="group relative grid xl:grid-cols-[80px_3fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 items-center bg-[#151a2a] border border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-600 hover:shadow-xl hover:shadow-black/50"
                >
                  {/* Compare Btn */}
                  <div className="flex items-center justify-center xl:justify-start">
                    <Link
                      href={toggleCompareHref(m.id)}
                      className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
                        isSelected
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white"
                      }`}
                    >
                      {isSelected ? "✓" : "+"}
                    </Link>
                  </div>

                  {/* Model Identity */}
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-[#0b0e14] p-1 border border-slate-800 shrink-0 overflow-hidden relative">
                      {m.imageUrl ? (
                        <Image src={m.imageUrl} alt={m.name} fill className="object-contain" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-lg">🧊</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={machineHref}
                        className="block font-bold text-white text-base truncate hover:text-orange-400 transition-colors"
                      >
                        {m.name}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>{row.manufacturer?.displayName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            m.status === "AVAILABLE"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hashrate & Release */}
                  <div className="text-sm font-mono text-slate-300 flex flex-col">
                    <span>
                      <span className="font-bold text-white">{m.hashrate}</span> {m.hashrateUnit}
                    </span>
                    <span className="text-[10px] text-slate-500">{releaseLabel}</span>
                  </div>

                  {/* Power */}
                  <div className="text-sm font-mono text-slate-300">
                    {m.powerW}
                    <span className="text-xs text-slate-500">W</span>
                  </div>

                  {/* Efficiency */}
                  <div className="text-sm font-mono text-slate-400">{efficiencyLabel}</div>

                  {/* Algo */}
                  <div className="text-xs font-bold text-slate-400 uppercase truncate">{m.algorithm.name}</div>

                  {/* Coins */}
                  <div className="flex -space-x-1 overflow-hidden">
                    {getCoinsForAlgorithmName(m.algorithm.name)
                      .slice(0, 3)
                      .map((c) => {
                        const logo = getCoinLogoForSymbol(c);
                        return logo ? (
                          <img
                            key={c}
                            src={logo.src}
                            alt={c}
                            className="h-6 w-6 rounded-full border border-[#151a2a] bg-slate-800"
                          />
                        ) : null;
                      })}
                  </div>

                  {/* Price */}
                  <div className="text-right xl:text-right">
                    {row.lowest ? (
                      <div className="font-bold text-white">
                        {formatMoney(row.lowest.displayAmount, row.lowest.displayCurrency)}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600">No Offers</div>
                    )}
                  </div>

                  {/* Profit */}
                  <div className="text-right">
                    <div className={`font-bold ${profitColor} text-base`}>{row.profitDisplay}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{roiText}</div>
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          // --- GRID VIEW ---
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {enriched.map((row) => {
              const m = row.m;
              const isSelected = compareSet.has(m.id);
              const profitColor = row.profitUsd && row.profitUsd > 0 ? "text-emerald-400" : "text-red-400";

              // ✅ Efficiency Logic: Prefer DB -> Fallback calc
              let efficiencyLabel = "—";
              if ((m as any).efficiency && (m as any).efficiencyUnit) {
                efficiencyLabel = `${(m as any).efficiency} ${(m as any).efficiencyUnit}`;
              } else {
                const fallback = calcEfficiencyFallbackJPerTh(m.hashrate, m.hashrateUnit, m.powerW);
                if (fallback) efficiencyLabel = fallback;
              }

              const releaseLabel = formatReleaseAny(row.releaseAny);
              const machineHref = buildMachineHref(sp, m.slug);

              return (
                <div
                  key={m.id}
                  className="group relative bg-[#151a2a] border border-slate-800 rounded-3xl p-5 hover:border-slate-600 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 flex flex-col"
                >
                  {/* Top Row: Algo + Compare */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="px-2.5 py-1 rounded-lg bg-[#0b0e14] border border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {m.algorithm.name}
                    </div>
                    <Link
                      href={toggleCompareHref(m.id)}
                      className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
                        isSelected
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white"
                      }`}
                    >
                      {isSelected ? "✓" : "+"}
                    </Link>
                  </div>

                  {/* Image */}
                  <Link href={machineHref} className="flex-1 w-full flex items-center justify-center mb-4">
                    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-slate-900/50 p-4">
                      {m.imageUrl ? (
                        <Image
                          src={m.imageUrl}
                          alt={m.name}
                          fill
                          className="object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-4xl opacity-20">🧊</div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <h3 className="font-bold text-white text-lg leading-tight group-hover:text-orange-400 transition-colors">
                        <Link href={machineHref}>{m.name}</Link>
                      </h3>
                    </div>
                    <div className="text-xs text-slate-500 mb-4">{row.manufacturer?.displayName}</div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-[#0b0e14] rounded-xl p-2.5 border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Hashrate</div>
                        <div className="text-white font-mono text-sm">
                          {m.hashrate} <span className="text-xs text-slate-500">{m.hashrateUnit}</span>
                        </div>
                      </div>
                      <div className="bg-[#0b0e14] rounded-xl p-2.5 border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Power</div>
                        <div className="text-white font-mono text-sm">
                          {m.powerW} <span className="text-xs text-slate-500">W</span>
                        </div>
                      </div>
                      <div className="bg-[#0b0e14] rounded-xl p-2.5 border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Efficiency</div>
                        <div className="text-white font-mono text-sm">{efficiencyLabel}</div>
                      </div>
                      <div className="bg-[#0b0e14] rounded-xl p-2.5 border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Release</div>
                        <div className="text-white font-mono text-sm truncate">{releaseLabel}</div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-end justify-between border-t border-slate-800 pt-4">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Best Price</div>
                        {row.lowest ? (
                          <div className="text-white font-bold text-lg">
                            {formatMoney(row.lowest.displayAmount, row.lowest.displayCurrency)}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-600">No Offers</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${profitColor} text-lg`}>{row.profitDisplay}</div>
                        <div className="text-[10px] text-slate-500">/day</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {enriched.length === 0 && (
          <div className="mt-12 text-center py-20 bg-[#151a2a] rounded-3xl border border-slate-800 border-dashed">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-white font-bold text-xl">No machines found</h3>
            <p className="text-slate-500 mt-2">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </main>
  );
}