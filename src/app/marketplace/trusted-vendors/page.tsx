import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { formatMoney, getLatestFxRates } from "@/server/public";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

const REGIONS = ["GLOBAL", "US", "EU", "ASIA"];

// --- UTILS ---

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** * Reusable Stat Pill for the Hero Section 
 */
function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "blue";
}) {
  const colors = {
    default: "text-zinc-400",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-3 transition-transform hover:scale-105">
      <div className={cn("text-xl font-bold tracking-tight", colors[tone])}>{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</div>
    </div>
  );
}

/**
 * Modern Trust Level Indicator
 */
function TrustBadge({ level }: { level: string }) {
  const isHigh = level === "HIGH";
  const isMed = level === "MEDIUM";
  
  const score = isHigh ? 3 : isMed ? 2 : 1;
  const color = isHigh ? "bg-emerald-500" : isMed ? "bg-blue-500" : "bg-zinc-600";
  const shadow = isHigh ? "shadow-[0_0_10px_rgba(16,185,129,0.4)]" : isMed ? "shadow-[0_0_10px_rgba(59,130,246,0.4)]" : "";

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
        isHigh ? "text-emerald-400" : isMed ? "text-blue-400" : "text-zinc-500"
      )}>
        {level}
      </span>
    </div>
  );
}

// --- PAGE COMPONENT ---

export default async function TrustedVendorsPage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  
  // 1. Parse Filters
  const q = String(firstParam(sp.q) ?? "").trim();
  const region = String(firstParam(sp.region) ?? "").toUpperCase();
  const verifiedOnly = String(firstParam(sp.verified) ?? "") === "on";

  // 2. Build Query
  const where: Prisma.VendorWhereInput = {
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(verifiedOnly ? { isVerified: true } : {}),
    ...(region && region !== "ALL" ? { 
        offerings: { some: { regionKey: region } }
    } : {}),
  };

  // 3. Fetch Vendors with Aggregates
  const vendorsRaw = await prisma.vendor.findMany({
    where,
    include: {
      offerings: {
        where: { inStock: true },
        orderBy: { price: 'asc' }, // Get cheapest first for preview
        take: 3,
        include: { machine: true }
      },
      _count: {
        select: { offerings: { where: { inStock: true } } }
      }
    },
    orderBy: [
      { isVerified: 'desc' }, // Verified first
      { trustLevel: 'desc' }, // High trust second
      { name: 'asc' }
    ]
  });

  // 4. Enrich Data
  const vendors = vendorsRaw.map(v => {
    // Determine primary region based on offerings or country fallback
    const derivedRegion = v.country || (v.offerings[0]?.regionKey ?? "GLOBAL");
    
    // Format offerings for preview
    const previewOffers = v.offerings.map(o => {
        const rawPrice = Number(o.price);
        return {
            id: o.id,
            machineName: o.machine.name,
            machineSlug: o.machine.slug,
            priceDisplay: formatMoney(rawPrice, o.currency),
            region: o.regionKey
        };
    });

    return {
      ...v,
      stockCount: v._count.offerings,
      primaryRegion: derivedRegion,
      previewOffers
    };
  });

  // 5. Extract "Top Vendors" (Verified + High Trust + Stock)
  const topVendors = vendors
    .filter(v => v.isVerified && v.trustLevel === 'HIGH' && v.stockCount > 0)
    .sort((a, b) => b.stockCount - a.stockCount)
    .slice(0, 4);

  const totalVendors = vendors.length;
  const totalOffers = vendors.reduce((acc, v) => acc + v.stockCount, 0);

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 text-zinc-200">
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden border-b border-white/5 bg-zinc-900/50 pt-10 pb-8 px-4 md:px-6 shadow-xl">
         {/* Background Mesh */}
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-500/10 via-zinc-900/0 to-zinc-950/0 pointer-events-none" />
         
         <div className="relative z-10 mx-auto max-w-[1400px]">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
             <div>
               <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-4">
                 <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                 </span>
                 Verified Directory
               </div>
               <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Trusted Vendors</h1>
               <p className="mt-2 text-zinc-400 max-w-xl text-sm md:text-base leading-relaxed">
                 A curated network of verified hardware suppliers. We verify identities and track inventory so you can buy with confidence.
               </p>
             </div>
             
             <div className="flex flex-wrap gap-4">
               <StatPill label="Active Vendors" value={String(totalVendors)} tone="default" />
               <StatPill label="Live Offers" value={String(totalOffers)} tone="blue" />
               <StatPill label="Top Rated" value={String(topVendors.length)} tone="emerald" />
             </div>
           </div>
         </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 mt-8">

        {/* 2. COMMAND CENTER (FILTERS) */}
        <div className="sticky top-4 z-40 mb-8 rounded-3xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md">
          <form className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            
            {/* Search Input */}
            <div className="relative group flex-1 min-w-[200px]">
              <div className="absolute inset-y-0 left-3 flex items-center text-zinc-500 group-focus-within:text-emerald-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <input 
                name="q" 
                defaultValue={q} 
                placeholder="Find a vendor by name..." 
                className="w-full h-12 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-emerald-500/50 focus:bg-black/40 outline-none transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {/* Region Select */}
              <div className="relative">
                <select 
                  name="region" 
                  defaultValue={region || "ALL"} 
                  className="h-12 pl-4 pr-10 bg-black/20 border border-white/10 rounded-xl text-sm text-zinc-300 outline-none cursor-pointer focus:border-emerald-500/50 hover:bg-white/5 transition-all appearance-none"
                >
                  <option value="ALL" className="bg-zinc-900">All Regions</option>
                  {REGIONS.map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>

              {/* Verified Toggle */}
              <label className="flex items-center gap-3 cursor-pointer bg-black/20 px-4 h-12 rounded-xl border border-white/10 select-none hover:bg-white/5 transition-colors">
                <span className="text-sm font-bold text-zinc-300">Verified Only</span>
                <input 
                  type="checkbox" 
                  name="verified" 
                  defaultChecked={verifiedOnly} 
                  className="accent-emerald-500 h-4 w-4 rounded border-zinc-600 bg-zinc-800" 
                />
              </label>

              <button className="h-12 px-8 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                Search
              </button>
            </div>
          </form>
        </div>

        {/* 3. FEATURED VENDORS */}
        {topVendors.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-bold uppercase text-zinc-500 tracking-wider">Featured Partners</span>
              <div className="h-px bg-white/5 flex-1" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {topVendors.map(v => (
                <Link key={v.id} href={`/marketplace/trusted-vendors/${v.slug}`} className="group block">
                  <div className="relative bg-gradient-to-b from-zinc-800/40 to-zinc-900/40 border border-white/5 rounded-3xl p-5 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/10 hover:border-emerald-500/30">
                    <div className="absolute top-4 right-4">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-5">
                      <div className="h-14 w-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-xl font-bold text-zinc-600 overflow-hidden shadow-inner">
                         {v.logoUrl ? <Image src={v.logoUrl} alt={v.name} width={56} height={56} className="w-full h-full object-cover"/> : v.name.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white text-lg flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                          {v.name}
                          <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        </div>
                        <div className="text-xs text-zinc-500 font-medium">{v.primaryRegion}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-black/20 rounded-xl p-3 border border-white/5">
                      <div>
                        <div className="text-[10px] uppercase text-zinc-500 font-bold">Inventory</div>
                        <div className="text-white font-mono font-bold">{v.stockCount} Items</div>
                      </div>
                      <TrustBadge level={v.trustLevel} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 4. MAIN VENDOR GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {vendors.map(v => (
            <div key={v.id} className="group flex flex-col bg-zinc-900/30 border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-all hover:bg-zinc-900/50">
              
              {/* Card Header */}
              <div className="p-6 border-b border-white/5 flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                     {v.logoUrl ? <Image src={v.logoUrl} alt={v.name} width={48} height={48} className="w-full h-full object-cover"/> : <span className="text-lg font-bold text-zinc-600">{v.name.slice(0,2).toUpperCase()}</span>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-lg group-hover:text-emerald-400 transition-colors">{v.name}</h3>
                      {v.isVerified && <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <TrustBadge level={v.trustLevel} />
                      <span className="text-[10px] font-bold text-zinc-600 px-1.5 py-0.5 rounded bg-white/5 uppercase">{v.primaryRegion}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                   <div className="text-2xl font-bold text-white">{v.stockCount}</div>
                   <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Offers</div>
                </div>
              </div>

              {/* Offerings Preview */}
              <div className="flex-1 p-6 bg-black/10">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Latest Inventory</div>
                {v.previewOffers.length > 0 ? (
                  <div className="space-y-2">
                    {v.previewOffers.map(o => (
                      <Link 
                        key={o.id} 
                        href={`/machines/${o.machineSlug}`}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 hover:bg-white/10 transition-all group/item"
                      >
                        <span className="text-xs font-medium text-zinc-300 group-hover/item:text-white truncate max-w-[60%]">{o.machineName}</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">{o.priceDisplay}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-zinc-600 gap-2 opacity-50">
                    <span className="text-2xl">📦</span>
                    <span className="text-xs italic">No active listings</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-white/5 flex gap-3">
                <Link 
                  href={`/marketplace/trusted-vendors/${v.slug}`} 
                  className="flex-1 h-10 flex items-center justify-center bg-white text-zinc-950 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-zinc-200 transition-colors"
                >
                  View Profile
                </Link>
                {v.websiteUrl && (
                  <a 
                    href={v.websiteUrl} 
                    target="_blank" 
                    rel="noreferrer nofollow"
                    className="h-10 w-12 flex items-center justify-center rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Visit Website"
                  >
                    ↗
                  </a>
                )}
              </div>

            </div>
          ))}
        </div>

        {/* EMPTY STATE */}
        {vendors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30">
            <div className="text-6xl mb-6 opacity-20">🕵️</div>
            <h3 className="text-xl font-bold text-white">No vendors found</h3>
            <p className="text-zinc-500 mt-2 text-sm">Try adjusting your filters or search terms.</p>
            <Link href="/marketplace/trusted-vendors" className="mt-6 px-6 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 transition-colors">
              Reset Filters
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}