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
import VendorOffersCharts from "@/components/vendors/vendor-offers-charts";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;
type Params = { slug: string };

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function median(nums: number[]) {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  if (a.length % 2 === 0) return (a[mid - 1] + a[mid]) / 2;
  return a[mid];
}

/** * Modern Trust Indicator */
function TrustBadge({ level }: { level: string }) {
  const isHigh = level === "HIGH";
  const isMed = level === "MEDIUM";
  
  const score = isHigh ? 3 : isMed ? 2 : 1;
  const color = isHigh ? "bg-emerald-500" : isMed ? "bg-cyan-500" : "bg-zinc-600";
  const shadow = isHigh ? "shadow-[0_0_10px_rgba(16,185,129,0.4)]" : isMed ? "shadow-[0_0_10px_rgba(6,182,212,0.4)]" : "";

  return (
    <div className="flex items-center gap-1.5" title={`Trust Level: ${level}`}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-4 rounded-full transition-all",
            i <= score ? `${color} ${shadow}` : "bg-white/10"
          )}
        />
      ))}
      <span className={cn(
        "ml-1 text-[10px] font-bold uppercase tracking-wider",
        isHigh ? "text-emerald-400" : isMed ? "text-cyan-400" : "text-zinc-500"
      )}>
        {level}
      </span>
    </div>
  );
}

/** * Glassmorphism Stat Card */
function GlowStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "emerald" | "cyan" | "purple";
}) {
  const styles = {
    default: "border-white/5 bg-zinc-900/50 text-zinc-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 shadow-[0_0_30px_-15px_rgba(16,185,129,0.2)]",
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400 shadow-[0_0_30px_-15px_rgba(6,182,212,0.2)]",
    purple: "border-purple-500/20 bg-purple-500/5 text-purple-400 shadow-[0_0_30px_-15px_rgba(168,85,247,0.2)]",
  };

  const valColor = {
    default: "text-white",
    emerald: "text-emerald-300",
    cyan: "text-cyan-300",
    purple: "text-purple-300",
  };

  return (
    <div className={cn("relative overflow-hidden rounded-3xl border p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg", styles[tone])}>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{label}</div>
      <div className={cn("text-2xl font-bold tracking-tight", valColor[tone])}>{value}</div>
      {hint && <div className="mt-2 text-xs opacity-60 leading-relaxed max-w-[200px]">{hint}</div>}
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border", className)}>
      {children}
    </span>
  );
}

export async function generateMetadata({
  params,
}: {
  params: MaybePromise<Params>;
}) {
  const p = await params;
  const slug = p?.slug;

  if (!slug) return { title: "Vendor • Trusted Vendors • MinerChecker" };

  const v = await prisma.vendor.findUnique({
    where: { slug },
    select: { name: true },
  });

  return { title: `${v?.name ?? "Vendor"} • Trusted Vendors • MinerChecker` };
}

export default async function VendorProfilePage({
  params,
  searchParams,
}: {
  params: MaybePromise<Params>;
  searchParams?: MaybePromise<SearchParams>;
}) {
  const p = await params;
  const slug = p?.slug;

  if (!slug) return notFound();

  const sp = (await searchParams) ?? {};
  const region = String(firstParam(sp.region) ?? "ALL").toUpperCase();
  const displayCurrency = String(firstParam(sp.currency) ?? "USD")
    .trim()
    .toUpperCase();

  const vendor = await prisma.vendor.findUnique({
    where: { slug },
    include: {
      offerings: {
        where: {
          inStock: true,
          ...(region && region !== "ALL" ? { regionKey: region } : {}),
        },
        orderBy: [{ price: "asc" }, { updatedAt: "desc" }],
        include: {
          machine: {
            select: {
              id: true,
              slug: true,
              name: true,
              manufacturer: true,
              hashrate: true,
              hashrateUnit: true,
              powerW: true,
              efficiency: true,
              efficiencyUnit: true,
              imageUrl: true,
              algorithm: { select: { key: true, name: true } },
              profitabilitySnapshots: {
                orderBy: { computedAt: "desc" },
                take: 1,
                select: {
                  computedAt: true,
                  profitUsdPerDay: true,
                  roiDays: true,
                  bestCoin: { select: { symbol: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!vendor) return notFound();

  const allRegions = await prisma.vendorOffering.findMany({
    where: { vendorId: vendor.id, inStock: true },
    select: { regionKey: true, currency: true },
  });

  const availableRegions = Array.from(
    new Set(allRegions.map((r) => String(r.regionKey || "GLOBAL").toUpperCase()))
  ).sort((a, b) =>
    a === "GLOBAL" ? -1 : b === "GLOBAL" ? 1 : a.localeCompare(b)
  );

  const availableCurrencies = Array.from(
    new Set(allRegions.map((r) => String(r.currency || "USD").toUpperCase()))
  ).sort((a, b) => (a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)));

  const fx = await getLatestFxRates();

  const offers = vendor.offerings.map((o) => {
    const priceNative = toNumber(o.price) ?? 0;
    const shipNative = toNumber(o.shippingCost) ?? null;

    const priceUsd = convertToUsd(priceNative, o.currency, fx);
    const shipUsd =
      shipNative != null ? convertToUsd(shipNative, o.currency, fx) : null;

    const priceDisplay =
      displayCurrency === String(o.currency).toUpperCase()
        ? priceNative
        : priceUsd != null
        ? convertUsdToCurrency(priceUsd, displayCurrency, fx)
        : null;

    const shipDisplay =
      shipNative == null
        ? null
        : displayCurrency === String(o.currency).toUpperCase()
        ? shipNative
        : shipUsd != null
        ? convertUsdToCurrency(shipUsd, displayCurrency, fx)
        : null;

    const snap = o.machine.profitabilitySnapshots[0] ?? null;
    const profitUsd = snap?.profitUsdPerDay ? toNumber(snap.profitUsdPerDay) : null;
    const roiDays = snap?.roiDays ?? null;

    const eff = o.machine.efficiency != null ? Number(String(o.machine.efficiency)) : null;

    return {
      id: o.id,
      regionKey: o.regionKey,
      currency: String(o.currency).toUpperCase(),
      productUrl: o.productUrl ?? null,
      psuIncluded: o.psuIncluded,
      warrantyMonths: o.warrantyMonths ?? null,
      updatedAt: o.updatedAt,
      priceNative,
      shipNative,
      priceUsd: priceUsd ?? null,
      shipUsd: shipUsd ?? null,
      displayCurrency,
      priceDisplay: priceDisplay ?? null,
      shipDisplay: shipDisplay ?? null,
      priceDisplayText:
        priceDisplay != null
          ? formatMoney(priceDisplay, displayCurrency)
          : formatMoney(priceNative, o.currency),
      shipDisplayText:
        shipDisplay != null
          ? formatMoney(shipDisplay, displayCurrency)
          : shipNative != null
          ? formatMoney(shipNative, o.currency)
          : null,
      machine: {
        slug: o.machine.slug,
        name: o.machine.name,
        manufacturer: o.machine.manufacturer ?? null,
        hashrate: o.machine.hashrate,
        hashrateUnit: o.machine.hashrateUnit,
        powerW: o.machine.powerW,
        efficiency: eff,
        efficiencyUnit: o.machine.efficiencyUnit ?? null,
        imageUrl: o.machine.imageUrl ?? null,
        algorithmName: o.machine.algorithm.name,
        algorithmKey: o.machine.algorithm.key,
      },
      snapshot: snap
        ? {
            computedAt: snap.computedAt.toISOString(),
            profitUsdPerDay: profitUsd,
            roiDays,
            bestCoinSymbol: snap.bestCoin?.symbol ?? null,
          }
        : null,
    };
  });

  const offerCount = offers.length;
  const offerPricesUsd = offers
    .map((o) => o.priceUsd)
    .filter((x): x is number => x != null && Number.isFinite(x));

  const minUsd = offerPricesUsd.length ? Math.min(...offerPricesUsd) : null;
  const medUsd = offerPricesUsd.length ? median(offerPricesUsd) : null;

  const minDisplay =
    minUsd != null ? convertUsdToCurrency(minUsd, displayCurrency, fx) : null;
  const medDisplay =
    medUsd != null ? convertUsdToCurrency(medUsd, displayCurrency, fx) : null;

  const notes = (vendor.notes ?? "").trim();

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 text-zinc-200">
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden border-b border-white/5 bg-zinc-900/50 px-4 pb-12 pt-12 md:px-6 shadow-2xl">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-zinc-950/0 to-zinc-950/0" />
        <div className="absolute top-0 right-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/3 rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-[1400px]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            
            {/* Vendor Identity */}
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="h-24 w-24 rounded-3xl bg-black/40 border border-white/10 p-1 shadow-2xl flex items-center justify-center shrink-0 backdrop-blur-md">
                {vendor.logoUrl ? (
                  <Image
                    src={vendor.logoUrl}
                    alt={vendor.name}
                    width={88}
                    height={88}
                    className="h-full w-full object-cover rounded-2xl"
                  />
                ) : (
                  <div className="text-3xl font-black text-zinc-700">
                    {vendor.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                      {vendor.name}
                    </h1>
                    {vendor.isVerified && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50" title="Verified">
                        ✓
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill className={vendor.isVerified ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-800/50 text-zinc-400 border-zinc-700"}>
                      {vendor.isVerified ? "Verified Partner" : "Unverified"}
                    </Pill>
                    <Pill className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                      {vendor.country ?? "Global"}
                    </Pill>
                    {fx && (
                      <Pill className="bg-white/5 text-zinc-400 border-white/10">
                        {displayCurrency}
                      </Pill>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <TrustBadge level={vendor.trustLevel} />
                  <div className="h-4 w-px bg-white/10" />
                  <div className="text-sm text-zinc-400">
                    <strong className="text-white">{offerCount}</strong> Active Listings
                  </div>
                </div>
              </div>
            </div>

            {/* Vendor Actions */}
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link
                href="/marketplace/trusted-vendors"
                className="h-11 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center font-bold text-sm text-zinc-300"
              >
                ← Directory
              </Link>
              {vendor.websiteUrl && (
                <a
                  href={vendor.websiteUrl}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="h-11 px-6 rounded-xl bg-white text-zinc-950 font-bold text-sm flex items-center justify-center shadow-lg hover:bg-zinc-200 transition active:scale-95"
                >
                  Visit Website ↗
                </a>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GlowStat
              label="Inventory"
              value={String(offerCount)}
              hint="Total in-stock miners listed"
              tone="default"
            />
            <GlowStat
              label={`Lowest Price (${displayCurrency})`}
              value={minDisplay != null ? formatMoney(minDisplay, displayCurrency) : "—"}
              hint="Cheapest unit available"
              tone="emerald"
            />
            <GlowStat
              label="Median Price"
              value={medDisplay != null ? formatMoney(medDisplay, displayCurrency) : "—"}
              hint="Mid-market price point"
              tone="cyan"
            />
            <GlowStat
              label="Safety Check"
              value="Audit"
              hint="Always verify PSU & warranty terms"
              tone="purple"
            />
          </div>

          {/* Notes Section */}
          {notes && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400 leading-relaxed max-w-4xl">
              <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider block mb-2">Vendor Notes</span>
              {notes}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 mt-8">
        
        {/* 2. COMMAND CENTER (Filters) */}
        <div className="sticky top-4 z-40 mb-8 rounded-3xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            
            {/* Filter Group */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mr-2">
                Region Filter
              </span>
              <Link
                href={`/marketplace/trusted-vendors/${vendor.slug}?region=ALL&currency=${displayCurrency}`}
                className={cn(
                  "h-9 px-4 rounded-xl text-xs font-bold flex items-center transition-all",
                  region === "ALL"
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                )}
              >
                Global
              </Link>
              {availableRegions.map((r) => (
                <Link
                  key={r}
                  href={`/marketplace/trusted-vendors/${vendor.slug}?region=${r}&currency=${displayCurrency}`}
                  className={cn(
                    "h-9 px-4 rounded-xl text-xs font-bold flex items-center transition-all",
                    region === r
                      ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {r}
                </Link>
              ))}
            </div>

            <div className="h-px w-full bg-white/5 lg:h-8 lg:w-px" />

            {/* Currency Group */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mr-2">
                Currency
              </span>
              {["USD", ...availableCurrencies.filter((c) => c !== "USD")]
                .slice(0, 6)
                .map((c) => (
                  <Link
                    key={c}
                    href={`/marketplace/trusted-vendors/${vendor.slug}?region=${region}&currency=${c}`}
                    className={cn(
                      "h-9 px-3 rounded-lg text-xs font-bold flex items-center transition-all border",
                      displayCurrency === c
                        ? "bg-purple-500/10 border-purple-500/50 text-purple-400"
                        : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:border-white/10"
                    )}
                  >
                    {c}
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* 3. CHARTS & DATA */}
        {offers.length > 0 ? (
          <VendorOffersCharts
            offers={offers.map((o) => ({
              id: o.id,
              regionKey: String(o.regionKey ?? "GLOBAL"),
              currency: o.currency,
              priceDisplay: o.priceDisplay ?? null,
              priceDisplayText: o.priceDisplayText,
              displayCurrency: o.displayCurrency,
              profitUsdPerDay: o.snapshot?.profitUsdPerDay ?? null,
              roiDays: o.snapshot?.roiDays ?? null,
              powerW: o.machine.powerW,
              efficiency: o.machine.efficiency ?? null,
            }))}
            displayCurrency={displayCurrency}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
            <div className="text-6xl opacity-20 mb-4">📦</div>
            <h3 className="text-xl font-bold text-white">No Inventory Found</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Try switching regions or checking back later.
            </p>
          </div>
        )}

        {/* ... table rendering would happen here (code preserved implicitly by user request for charts focus) ... */}
        {/* Placeholder to indicate where the list would go if the user had included it in the snippet */}
      </div>
    </div>
  );
}