import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { MANUFACTURERS, findManufacturerByName, type ManufacturerOption } from "@/lib/manufacturers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manufacturers • MinerChecker" };

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

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

  const u = String(rawUnit ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");

  if (!u || u.includes("j/th")) return n;
  if (u.includes("j/gh")) return n * 1000;
  if (u.includes("w/th")) return n;
  if (u.includes("w/gh")) return n * 1000;
  return n;
}

/**
 * Notes are NOT in ManufacturerOption type, but MANUFACTURERS list may contain them at runtime.
 */
const NOTES_BY_SLUG = new Map<string, string>(
  (MANUFACTURERS as any[])
    .map((m) => {
      const slug = String(m?.slug ?? "");
      const notes = typeof m?.notes === "string" ? m.notes : "";
      return [slug, notes] as const;
    })
    .filter(([slug, notes]) => slug && notes)
);

NOTES_BY_SLUG.set("other", "Manufacturers not yet mapped in the directory.");

function getNotesForSlug(slug: string): string | null {
  const n = NOTES_BY_SLUG.get(slug);
  return n && n.trim() ? n : null;
}

function resolveManufacturer(manufacturerRaw: string | null): ManufacturerOption | null {
  const raw = (manufacturerRaw ?? "").trim();
  if (!raw) return null;

  const byName = findManufacturerByName(raw);
  if (byName) return byName;

  const s = slugifyLoose(raw);
  const bySlug = MANUFACTURERS.find((m) => m.slug.toLowerCase() === s);
  if (bySlug) return bySlug;

  const lower = raw.toLowerCase();
  return (
    MANUFACTURERS.find((m) => lower === m.name.toLowerCase()) ??
    MANUFACTURERS.find((m) => lower.includes(m.name.toLowerCase())) ??
    null
  );
}

function MiniMeter({
  label,
  value,
  max,
  tone = "cyan",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "cyan" | "fuchsia" | "emerald";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  const styles = {
    cyan: { text: "text-cyan-400", bar: "bg-cyan-500", glow: "shadow-[0_0_8px_rgba(6,182,212,0.6)]" },
    fuchsia: { text: "text-fuchsia-400", bar: "bg-fuchsia-500", glow: "shadow-[0_0_8px_rgba(217,70,239,0.6)]" },
    emerald: { text: "text-emerald-400", bar: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.6)]" },
  };
  const t = styles[tone] || styles.cyan;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className={cn("font-mono", t.text)}>{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
        <div
          className={cn("h-full rounded-full transition-all duration-500", t.bar, t.glow)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const q = String(firstParam(sp.q) ?? "").trim().toLowerCase();
  const regionKey = String(firstParam(sp.region) ?? "GLOBAL").toUpperCase();
  const sort = String(firstParam(sp.sort) ?? "offers").toLowerCase();

  const regionWhere =
    regionKey === "GLOBAL" ? { inStock: true } : ({ inStock: true, regionKey } as const);

  const machines = await prisma.machine.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      manufacturer: true,
      releaseDate: true,
      efficiency: true,
      efficiencyUnit: true,
      algorithm: { select: { key: true, name: true } },
      vendorOfferings: { where: regionWhere, select: { id: true } },
    },
    take: 5000,
  });

  type Agg = {
    mfg: ManufacturerOption;
    machineCount: number;
    offersCount: number;
    algoKeys: Set<string>;
    newestRelease: Date | null;
    bestEffJTH: number | null;
    bestEffMachine: { name: string; slug: string; effJTH: number } | null;
  };

  const bySlug = new Map<string, Agg>();

  const unknown: ManufacturerOption = {
    name: "Other / Unknown",
    slug: "other",
    logo: undefined,
  };

  function getBucket(rawManufacturer: string | null): ManufacturerOption {
    return resolveManufacturer(rawManufacturer) ?? unknown;
  }

  for (const m of machines) {
    const bucket = getBucket(m.manufacturer);
    const key = bucket.slug;

    let agg = bySlug.get(key);
    if (!agg) {
      agg = {
        mfg: bucket,
        machineCount: 0,
        offersCount: 0,
        algoKeys: new Set<string>(),
        newestRelease: null,
        bestEffJTH: null,
        bestEffMachine: null,
      };
      bySlug.set(key, agg);
    }

    agg.machineCount++;
    agg.offersCount += m.vendorOfferings?.length ?? 0;
    if (m.algorithm?.key) agg.algoKeys.add(m.algorithm.key);

    if (m.releaseDate instanceof Date) {
      if (!agg.newestRelease || m.releaseDate.getTime() > agg.newestRelease.getTime()) {
        agg.newestRelease = m.releaseDate;
      }
    }

    const effJTH = normalizeEfficiencyToJPerTh(m.efficiency, m.efficiencyUnit);
    if (effJTH != null) {
      if (agg.bestEffJTH == null || effJTH < agg.bestEffJTH) {
        agg.bestEffJTH = effJTH;
        agg.bestEffMachine = { name: m.name, slug: m.slug, effJTH };
      }
    }
  }

  const list = Array.from(bySlug.values())
    .filter((x) => x.machineCount > 0)
    .filter((x) => {
      if (!q) return true;
      const notes = getNotesForSlug(x.mfg.slug) ?? "";
      const hay = `${x.mfg.name} ${x.mfg.slug} ${notes}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => {
      if (sort === "machines") return b.machineCount - a.machineCount;
      if (sort === "efficiency") return (a.bestEffJTH ?? Infinity) - (b.bestEffJTH ?? Infinity);
      if (sort === "newest")
        return (b.newestRelease?.getTime() ?? -1) - (a.newestRelease?.getTime() ?? -1);
      return b.offersCount - a.offersCount;
    });

  const maxOffers = Math.max(1, ...list.map((x) => x.offersCount));
  const maxMachines = Math.max(1, ...list.map((x) => x.machineCount));

  const href = (overrides: Record<string, string | undefined>) => {
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
  };

  const totalMachines = list.reduce((acc, x) => acc + x.machineCount, 0);
  const totalOffers = list.reduce((acc, x) => acc + x.offersCount, 0);

  return (
    <main className="min-h-screen bg-zinc-950 pb-20 pt-6 text-zinc-200">
      <div className="mx-auto max-w-[1450px] px-4 md:px-6">
        
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-zinc-900/50 p-8 md:p-12 shadow-2xl">
           {/* Background Mesh */}
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-zinc-900/0 to-zinc-950/0 pointer-events-none" />
           <div className="absolute top-0 right-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/3 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
           
           <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
             <div className="max-w-2xl">
               <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 mb-6">
                 <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                 </span>
                 Hardware Intelligence
               </div>
               
               <h1 className="text-4xl font-black text-white tracking-tight md:text-5xl lg:text-6xl">
                 Manufacturers <br />
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Index.</span>
               </h1>
               
               <p className="mt-6 text-lg text-zinc-400 leading-relaxed max-w-xl">
                 Navigate the ASIC landscape. Filter brands by efficiency, reliability history, and real-time inventory availability.
               </p>
             </div>

             <div className="grid grid-cols-2 gap-4 min-w-[280px]">
               <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
                 <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Brands</div>
                 <div className="mt-1 text-3xl font-black text-white">{list.length}</div>
               </div>
               <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
                 <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Live Offers</div>
                 <div className="mt-1 text-3xl font-black text-cyan-400">{totalOffers}</div>
               </div>
               <div className="rounded-3xl border border-white/5 bg-black/20 p-5 col-span-2">
                 <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total Models Tracked</div>
                 <div className="mt-1 text-3xl font-black text-white">{totalMachines}</div>
               </div>
             </div>
           </div>
        </section>

        {/* COMMAND CENTER */}
        <div className="sticky top-4 z-40 mt-8 rounded-3xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md transition-all">
          <form className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between" method="get">
            
            <div className="flex-1 min-w-[240px]">
              <div className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center text-zinc-500 group-focus-within:text-cyan-400 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search brands (e.g. Bitmain, Iceriver...)"
                  className="w-full h-12 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-cyan-500/50 focus:bg-black/40 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 bg-black/20 rounded-xl border border-white/10 p-1">
                 <select
                   name="region"
                   defaultValue={regionKey}
                   className="h-10 px-3 bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-cyan-400 uppercase tracking-wide"
                 >
                   <option value="GLOBAL" className="bg-zinc-900">Global Stock</option>
                   <option value="US" className="bg-zinc-900">USA Stock</option>
                   <option value="EU" className="bg-zinc-900">Europe Stock</option>
                   <option value="ASIA" className="bg-zinc-900">Asia Stock</option>
                 </select>
              </div>

              <div className="w-px h-8 bg-white/10 hidden sm:block" />

              <select
                name="sort"
                defaultValue={sort}
                className="h-12 px-4 bg-black/20 border border-white/10 rounded-xl text-sm font-medium text-zinc-300 outline-none focus:border-cyan-500/50 cursor-pointer hover:bg-white/5 transition-all"
              >
                <option value="offers" className="bg-zinc-900">Sort: Most Offers</option>
                <option value="machines" className="bg-zinc-900">Sort: Model Count</option>
                <option value="efficiency" className="bg-zinc-900">Sort: Best Efficiency</option>
                <option value="newest" className="bg-zinc-900">Sort: Newest Release</option>
              </select>

              <button className="h-12 px-6 bg-white text-black text-sm font-bold rounded-xl shadow-lg hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95">
                Update
              </button>

              <Link
                href={href({ q: undefined, sort: "offers" })}
                className="h-12 w-12 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                title="Reset Filters"
              >
                ↺
              </Link>
            </div>
          </form>
        </div>

        {/* BRAND GRID */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {list.map((row) => {
            const detailHref = row.mfg.slug === "other" ? href({}) : `/miners/manufacturers/${row.mfg.slug}${href({})}`;
            const topPick = row.bestEffMachine;
            const notes = getNotesForSlug(row.mfg.slug);
            const algoChips = Array.from(row.algoKeys).slice(0, 3);

            return (
              <div
                key={row.mfg.slug}
                className="group relative flex flex-col bg-zinc-900/40 border border-white/5 rounded-3xl p-6 hover:border-cyan-500/20 hover:bg-zinc-900/60 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 backdrop-blur-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/5 p-2 flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-105 transition-transform">
                      {row.mfg.logo ? (
                        <Image src={row.mfg.logo} alt={row.mfg.name} width={64} height={64} className="object-contain w-full h-full" />
                      ) : (
                        <span className="text-2xl opacity-20">🏭</span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight group-hover:text-cyan-400 transition-colors">
                        {row.mfg.name}
                      </h2>
                      {algoChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {algoChips.map(k => (
                            <span key={k} className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-[9px] font-bold text-zinc-500 uppercase">
                              {k}
                            </span>
                          ))}
                          {row.algoKeys.size > algoChips.length && (
                            <span className="text-[9px] font-bold text-zinc-600 self-center">+{row.algoKeys.size - algoChips.length}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {row.mfg.slug !== "other" && (
                    <Link
                      href={detailHref}
                      className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 border border-white/5 text-zinc-400 hover:bg-cyan-500 hover:text-black hover:border-cyan-400 transition-all -mr-2 -mt-2"
                    >
                      →
                    </Link>
                  )}
                </div>

                {/* Meters */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <MiniMeter label="Models" value={row.machineCount} max={maxMachines} tone="fuchsia" />
                  <MiniMeter label="Offers" value={row.offersCount} max={maxOffers} tone="cyan" />
                </div>

                {/* Highlights */}
                <div className="space-y-2 mb-6">
                   <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-zinc-500 font-medium">Newest Release</span>
                      <span className="text-zinc-300 font-mono">
                        {row.newestRelease ? new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(row.newestRelease) : "—"}
                      </span>
                   </div>
                   
                   <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-white/[0.02] border border-white/5 group-hover:border-emerald-500/20 transition-colors">
                      <span className="text-zinc-500 font-medium">Top Efficiency</span>
                      <div className="text-right">
                        {topPick ? (
                          <>
                            <div className="text-emerald-400 font-bold font-mono">{topPick.effJTH.toFixed(1)} J/TH</div>
                            <Link href={`/machines/${topPick.slug}`} className="text-[10px] text-zinc-600 hover:text-white transition-colors truncate max-w-[120px] block">
                              {topPick.name}
                            </Link>
                          </>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </div>
                   </div>
                </div>

                {/* Footer Notes */}
                {notes && (
                  <div className="mt-auto pt-4 border-t border-white/5">
                    <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2">
                      <strong className="text-zinc-400 uppercase mr-1">Note:</strong>
                      {notes}
                    </p>
                  </div>
                )}
                
              </div>
            );
          })}
        </section>

        {/* EMPTY STATE */}
        {list.length === 0 && (
          <div className="mt-12 flex flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-white/5 py-20 text-center">
            <div className="text-6xl mb-6 opacity-10 grayscale">🏭</div>
            <h3 className="text-xl font-bold text-white">No manufacturers found</h3>
            <p className="mt-2 text-zinc-500 text-sm">
              Try adjusting your search terms or filters.
            </p>
            <Link
              href={href({ q: undefined })}
              className="mt-6 px-6 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 transition-colors"
            >
              Clear Search
            </Link>
          </div>
        )}

      </div>
    </main>
  );
}