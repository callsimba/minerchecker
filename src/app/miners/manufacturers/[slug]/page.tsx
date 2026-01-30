import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  MANUFACTURERS,
  findManufacturerBySlug,
  findManufacturerByName,
  type ManufacturerOption,
} from "@/lib/manufacturers";

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

function slugifyLoose(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEfficiencyToJPerTh(rawVal: unknown, rawUnit: unknown): number | null {
  const n = Number(rawVal);
  if (!Number.isFinite(n) || n <= 0) return null;

  const u = String(rawUnit ?? "").toLowerCase().replace(/\s+/g, "");
  if (!u || u.includes("j/th")) return n;
  if (u.includes("j/gh")) return n * 1000;
  if (u.includes("w/th")) return n;
  if (u.includes("w/gh")) return n * 1000;
  return n;
}

const NOTES_BY_SLUG = new Map<string, string>(
  (MANUFACTURERS as any[])
    .map((m) => {
      const slug = String(m?.slug ?? "");
      const notes = typeof m?.notes === "string" ? m.notes : "";
      return [slug, notes] as const;
    })
    .filter(([slug, notes]) => slug && notes)
);

function getNotesForSlug(slug: string): string | null {
  const n = NOTES_BY_SLUG.get(slug);
  return n && n.trim() ? n : null;
}

function resolveMfg(slug: string): ManufacturerOption | null {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!s) return null;

  const bySlug = (findManufacturerBySlug as any)?.(s) as ManufacturerOption | undefined;
  if (bySlug) return bySlug;

  const direct = MANUFACTURERS.find((m) => m.slug.toLowerCase() === s);
  if (direct) return direct;

  const byName = findManufacturerByName(s);
  if (byName) return byName;

  const loose = slugifyLoose(s);
  return MANUFACTURERS.find((m) => m.slug.toLowerCase() === loose) ?? null;
}

function hrefMerge(sp: SearchParams, overrides: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const vv = firstParam(v);
    if (vv == null || vv === "") continue;
    p.set(k, String(vv));
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (!v) p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export async function generateMetadata({ params }: { params: MaybePromise<Params> }) {
  const p = await params;
  const slug = p?.slug;
  if (!slug) return { title: "Manufacturer • MinerChecker" };
  const mfg = resolveMfg(slug);
  return { title: `${mfg?.name ?? "Manufacturer"} • MinerChecker` };
}

export default async function ManufacturerDetailPage({
  params,
  searchParams,
}: {
  params: MaybePromise<Params>;
  searchParams?: MaybePromise<SearchParams>;
}) {
  const p = await params;
  const slug = p?.slug?.toLowerCase();
  if (!slug) return notFound();

  const sp = (await searchParams) ?? {};

  const regionKey = String(firstParam(sp.region) ?? "GLOBAL").toUpperCase();
  const q = String(firstParam(sp.q) ?? "").trim().toLowerCase();
  const algorithmKey = String(firstParam(sp.algorithm) ?? "").trim();
  const inStockOnly = String(firstParam(sp.stock) ?? "") === "on";
  const sort = String(firstParam(sp.sort) ?? "offers").toLowerCase();

  const mfg = resolveMfg(slug);
  if (!mfg) return notFound();

  const notes = getNotesForSlug(mfg.slug);

  const regionWhere =
    regionKey === "GLOBAL" ? { inStock: true } : ({ inStock: true, regionKey } as const);

  const machines = await prisma.machine.findMany({
    where: {
      manufacturer: { contains: mfg.name, mode: "insensitive" },
      ...(algorithmKey ? { algorithm: { key: algorithmKey } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(inStockOnly ? { vendorOfferings: { some: regionWhere } } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      manufacturer: true,
      imageUrl: true,
      releaseDate: true,
      powerW: true,
      hashrate: true,
      hashrateUnit: true,
      efficiency: true,
      efficiencyUnit: true,
      algorithm: { select: { key: true, name: true } },

      // Include offerings to show availability
      vendorOfferings: {
        where: regionWhere,
        orderBy: [{ price: "asc" }, { updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          price: true,
          currency: true,
          regionKey: true,
          inStock: true,
          updatedAt: true,
          vendor: {
            select: {
              name: true,
              slug: true,
              websiteUrl: true,
              trustLevel: true,
              isVerified: true,
              logoUrl: true,
            },
          },
        },
      },
    },
    take: 5000,
  });

  const algorithms = await prisma.algorithm.findMany({
    orderBy: { name: "asc" },
    select: { key: true, name: true },
  });

  const rows = machines.map((m) => {
    const offersCount = m.vendorOfferings?.length ?? 0;
    const effJTH = normalizeEfficiencyToJPerTh(m.efficiency, m.efficiencyUnit);
    const cheapest = (m.vendorOfferings ?? [])[0] ?? null;
    return { ...m, offersCount, effJTH, cheapest };
  });

  const machineCount = rows.length;
  const totalOffers = rows.reduce((acc, r) => acc + r.offersCount, 0);

  const newest =
    rows
      .map((r) => r.releaseDate)
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const bestEff =
    rows.filter((r) => r.effJTH != null).sort((a, b) => (a.effJTH ?? Infinity) - (b.effJTH ?? Infinity))[0] ??
    null;

  const bestOffer =
    rows.filter((r) => r.offersCount > 0).sort((a, b) => b.offersCount - a.offersCount)[0] ?? null;

  const sorted = [...rows].sort((a, b) => {
    if (sort === "machines") return a.name.localeCompare(b.name);
    if (sort === "efficiency") return (a.effJTH ?? Infinity) - (b.effJTH ?? Infinity);
    if (sort === "newest") return (b.releaseDate?.getTime?.() ?? -1) - (a.releaseDate?.getTime?.() ?? -1);
    return b.offersCount - a.offersCount;
  });

  const qs = (overrides: Record<string, string | undefined>) => hrefMerge(sp, overrides);

  return (
    <main className="min-h-screen bg-zinc-950 pb-20 pt-6 text-slate-200">
      <div className="mx-auto max-w-[1450px] px-4 md:px-6">
        
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/5 bg-zinc-900/50 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(232,121,249,0.1),transparent_50%)]" />

          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="h-20 w-20 rounded-3xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0 shadow-2xl">
                {mfg.logo ? (
                  <Image src={mfg.logo} alt={mfg.name} width={80} height={80} className="object-contain p-2" />
                ) : (
                  <span className="opacity-40 text-3xl">🏭</span>
                )}
              </div>

              <div className="space-y-4 max-w-2xl">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{mfg.name}</h1>
                    <span className="inline-flex items-center rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200">
                      Manufacturer
                    </span>
                  </div>
                  <p className="mt-3 text-slate-400 leading-relaxed text-sm">
                    Browse the full catalog of {mfg.name} miners. Filter by algorithm, efficiency (J/TH), and live availability.
                  </p>
                </div>

                {notes && (
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-xs text-slate-300 leading-relaxed">
                    <strong className="text-slate-500 uppercase tracking-wider mr-2">Note:</strong>
                    {notes}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-[280px]">
               <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                 <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Models</div>
                 <div className="mt-1 text-2xl font-black text-white">{machineCount}</div>
               </div>
               <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                 <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Live Offers</div>
                 <div className="mt-1 text-2xl font-black text-cyan-400">{totalOffers}</div>
               </div>
               <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                 <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Newest</div>
                 <div className="mt-1 text-sm font-mono text-slate-300">
                   {newest ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(newest) : "—"}
                 </div>
               </div>
               <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                 <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Best Eff.</div>
                 <div className="mt-1 text-sm font-mono text-emerald-400">
                   {bestEff?.effJTH != null ? `${bestEff.effJTH.toFixed(1)} J/TH` : "—"}
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* CONTROLS BAR */}
        <div className="sticky top-4 z-40 mt-8 rounded-[24px] border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md">
          <form method="get" className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 min-w-[200px]">
              <div className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">🔍</div>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder={`Search ${mfg.name} models...`}
                  className="w-full h-11 pl-10 pr-4 bg-black/20 rounded-xl border border-white/5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <input type="hidden" name="region" value={regionKey} />

              <select
                name="algorithm"
                defaultValue={algorithmKey}
                className="h-11 px-4 bg-black/20 rounded-xl border border-white/5 text-sm text-slate-200 outline-none focus:border-cyan-500/40 cursor-pointer appearance-none hover:bg-white/5 transition-colors min-w-[160px]"
              >
                <option value="" className="bg-zinc-900">All Algorithms</option>
                {algorithms.map((a) => (
                  <option key={a.key} value={a.key} className="bg-zinc-900">{a.name}</option>
                ))}
              </select>

              <label className="flex items-center gap-3 cursor-pointer bg-black/20 px-4 h-11 rounded-xl border border-white/5 select-none hover:border-white/10 transition-colors">
                <span className="text-sm font-bold text-slate-300">In-Stock Only</span>
                <input
                  type="checkbox"
                  name="stock"
                  defaultChecked={inStockOnly}
                  className="accent-cyan-500 h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
              </label>

              <select
                name="sort"
                defaultValue={sort}
                className="h-11 px-4 bg-black/20 rounded-xl border border-white/5 text-sm text-slate-200 outline-none focus:border-cyan-500/40 cursor-pointer appearance-none hover:bg-white/5 transition-colors"
              >
                <option value="offers" className="bg-zinc-900">Sort: Offers Count</option>
                <option value="efficiency" className="bg-zinc-900">Sort: Efficiency</option>
                <option value="newest" className="bg-zinc-900">Sort: Release Date</option>
                <option value="machines" className="bg-zinc-900">Sort: Name (A-Z)</option>
              </select>

              <button className="h-11 px-6 rounded-xl font-bold text-black bg-white hover:bg-slate-200 transition-colors shadow-lg active:scale-95">
                Update
              </button>

              <Link
                href={qs({ q: undefined, algorithm: undefined, stock: undefined, sort: "offers" })}
                className="h-11 w-11 rounded-xl border border-white/5 bg-black/20 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Reset Filters"
              >
                ↺
              </Link>
            </div>
          </form>
        </div>

        {/* RESULTS GRID */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sorted.map((m) => {
            const effBadge =
              m.effJTH != null
                ? m.effJTH <= 20
                  ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                  : "text-cyan-400 border-cyan-500/20 bg-cyan-500/10"
                : "text-slate-500 border-white/5 bg-black/20";

            return (
              <div
                key={m.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/40 p-5 transition-all hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-900/10"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-white/5 p-2 flex items-center justify-center border border-white/5">
                       {m.imageUrl ? (
                         <Image src={m.imageUrl} alt={m.name} width={40} height={40} className="object-contain h-full w-full" />
                       ) : (
                         <span className="text-xl opacity-20">⛏️</span>
                       )}
                    </div>
                    {m.offersCount > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                        {m.offersCount} Offers
                      </span>
                    )}
                  </div>

                  <Link href={`/machines/${m.slug}`} className="block">
                    <h3 className="text-lg font-bold text-white leading-tight group-hover:text-cyan-400 transition-colors mb-1">
                      {m.name}
                    </h3>
                    <div className="text-xs text-slate-500 font-mono mb-4">
                      {m.algorithm?.name ?? "Unknown Algo"}
                    </div>
                  </Link>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-black/20 rounded-xl p-2 border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Hashrate</div>
                      <div className="text-sm font-mono text-slate-200">
                        {m.hashrate} <span className="text-xs text-slate-500">{m.hashrateUnit}</span>
                      </div>
                    </div>
                    <div className={cn("rounded-xl p-2 border", effBadge)}>
                      <div className="text-[10px] uppercase font-bold opacity-70">Efficiency</div>
                      <div className="text-sm font-mono">
                        {m.effJTH != null ? `${m.effJTH.toFixed(1)} J/TH` : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Vendors Preview */}
                  {m.vendorOfferings?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {m.vendorOfferings.slice(0, 3).map((o) => (
                        <Link
                          key={o.id}
                          href={`/marketplace/trusted-vendors/${o.vendor.slug}`}
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                          title={`View offer from ${o.vendor.name}`}
                        >
                          {o.vendor.name}
                        </Link>
                      ))}
                      {m.vendorOfferings.length > 3 && (
                        <span className="px-2 py-1 text-[10px] text-slate-600">+{m.vendorOfferings.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-600 italic py-1">No in-stock offers found</div>
                  )}

                  <div className="flex gap-2 border-t border-white/5 pt-3">
                    <Link
                      href={`/machines/${m.slug}`}
                      className="flex-1 h-9 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wide flex items-center justify-center hover:bg-cyan-50 transition-colors shadow-lg shadow-white/5"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {sorted.length === 0 && (
          <div className="mt-12 flex flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-white/5 py-20 text-center">
            <div className="text-5xl mb-4 opacity-20">🔍</div>
            <h3 className="text-xl font-bold text-white">No miners found</h3>
            <p className="mt-2 text-slate-400 max-w-md mx-auto">
              We couldn't find any models matching your search. Try removing filters or searching for a different term.
            </p>
            <Link
              href={qs({ q: undefined, algorithm: undefined, stock: undefined })}
              className="mt-6 h-10 px-6 rounded-xl bg-white text-black font-bold flex items-center hover:bg-slate-200 transition-colors"
            >
              Clear Filters
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}