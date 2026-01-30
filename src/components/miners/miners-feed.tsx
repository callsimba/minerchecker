"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

// --- Types ---
export type EnrichedMiner = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  manufacturerData: { displayName: string; logo?: string | null };
  algorithm: { name: string; key: string };
  hashrate: string;
  hashrateUnit: string;
  powerW: number;
  efficiencyLabel: string;
  releaseLabel: string;
  status: string;
  profitDisplay: string;
  priceDisplay: string;
  profitUsd: number | null;
  bestPriceUsd: number | null;
  roiDays: number | null;
  hasRevenueData: boolean;
  machineHref: string;
  bestCoinLogo?: { src: string } | null;
  lowest?: { displayAmount: number; displayCurrency: string } | null;
};

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** Intersection Observer for Infinite Scroll */
function useOnScreen(options: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
    }, options);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options]);

  return { ref, isIntersecting };
}

export default function MinersFeed({
  initialMiners,
  compareIds,
  onToggleCompare,
  onClearCompare,
}: {
  initialMiners: EnrichedMiner[];
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onClearCompare: () => void;
}) {
  const searchParams = useSearchParams();
  // ✅ Default view is now 'list'
  const [view, setView] = useState<"grid" | "list">("list");

  // --- Infinite Scroll State ---
  const CHUNK_SIZE = 15;
  const [displayCount, setDisplayCount] = useState(CHUNK_SIZE);
  const { ref: loaderRef, isIntersecting } = useOnScreen({ threshold: 0.1 });

  // Reset scroll when filters change
  useEffect(() => {
    setDisplayCount(CHUNK_SIZE);
  }, [initialMiners]);

  // Load more trigger
  useEffect(() => {
    if (isIntersecting && displayCount < initialMiners.length) {
      const timer = setTimeout(() => {
        setDisplayCount((prev) => Math.min(prev + CHUNK_SIZE, initialMiners.length));
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isIntersecting, displayCount, initialMiners.length]);

  const visibleMiners = initialMiners.slice(0, displayCount);
  const compareSet = new Set(compareIds);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "list" || v === "grid") setView(v);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      
      {/* View Toggle & Count */}
      <div className="flex items-center justify-between px-2 mb-4">
        <div className="text-sm text-zinc-400">
          Showing <strong className="text-white">{Math.min(displayCount, initialMiners.length)}</strong> of {initialMiners.length} models
        </div>
        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/10 backdrop-blur-md">
          <button
            onClick={() => setView("list")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              view === "list" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span className="text-sm">☰</span> List
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              view === "grid" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span className="text-sm">▦</span> Grid
          </button>
        </div>
      </div>

      {/* --- LIST VIEW --- */}
      {view === "list" ? (
        <div className="space-y-3">
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

          {visibleMiners.map((m) => (
            <ListCard
              key={m.id}
              m={m}
              selected={compareSet.has(m.id)}
              onCompare={() => onToggleCompare(m.id)}
            />
          ))}
        </div>
      ) : (
        // --- GRID VIEW ---
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visibleMiners.map((m) => (
            <GridCard
              key={m.id}
              m={m}
              selected={compareSet.has(m.id)}
              onCompare={() => onToggleCompare(m.id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {initialMiners.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-900/30">
          <div className="text-6xl mb-6 opacity-20 grayscale">🔍</div>
          <h3 className="text-xl font-bold text-white">No miners found</h3>
          <p className="text-zinc-500 mt-2 text-sm">Try adjusting your filters or search terms.</p>
        </div>
      )}

      {/* Scroll Loader */}
      {displayCount < initialMiners.length && (
        <div ref={loaderRef} className="py-10 flex justify-center">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900 border border-white/5 text-xs font-bold text-zinc-500 animate-pulse">
            <span>Loading hardware...</span>
          </div>
        </div>
      )}

      {/* Floating Compare Notification - ✅ Visible on Mobile */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 p-2 pr-4 bg-zinc-950/90 border border-white/10 rounded-full shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-10 fade-in w-max max-w-[90vw]">
          <div className="flex items-center -space-x-2 pl-2">
             {compareIds.slice(0, 3).map(id => (
               <div key={id} className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[10px] text-zinc-500">M</div>
             ))}
             {compareIds.length > 3 && (
                <div className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-950 flex items-center justify-center text-[10px] text-zinc-500">+{compareIds.length - 3}</div>
             )}
          </div>
          <div className="text-xs text-white whitespace-nowrap">
            <span className="font-bold text-cyan-400">{compareIds.length}</span> selected
          </div>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <button 
             onClick={onClearCompare} 
             className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider transition-colors"
          >
            Clear
          </button>
          {compareIds.length >= 2 && (
             <Link 
               href={`/compare?ids=${compareIds.join(",")}`}
               className="ml-2 px-4 py-2 rounded-full bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 whitespace-nowrap"
             >
               Compare
             </Link>
          )}
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function GridCard({ m, selected, onCompare }: { m: EnrichedMiner; selected: boolean; onCompare: () => void }) {
  const isProfitable = (m.profitUsd ?? -1) > 0;
  const profitColor = isProfitable ? "text-emerald-400" : "text-red-400";
  
  const cardBorder = isProfitable 
    ? "border-emerald-500/20 hover:border-emerald-500/40" 
    : "border-red-500/10 hover:border-red-500/30";

  const profitBg = isProfitable 
    ? "bg-gradient-to-r from-emerald-500/10 to-transparent" 
    : "bg-gradient-to-r from-red-500/10 to-transparent";

  return (
    <div className={cn("group relative bg-zinc-900/40 rounded-[2rem] p-5 border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col backdrop-blur-sm", cardBorder)}>
      
      {/* Top Bar */}
      <div className="flex justify-between items-start mb-6 z-10 relative">
        <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[10px] font-bold text-zinc-400 uppercase tracking-wider backdrop-blur-md">
          {m.algorithm.name}
        </span>
        <button
          onClick={onCompare}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-xl border transition-all duration-200",
            selected
              ? "bg-cyan-500 border-cyan-500 text-black shadow-lg shadow-cyan-500/30"
              : "bg-black/20 border-white/10 text-zinc-500 hover:border-white/30 hover:text-white"
          )}
        >
          {selected ? "✓" : "+"}
        </button>
      </div>

      {/* Image */}
      <Link href={m.machineHref} className="flex-1 w-full flex items-center justify-center mb-8 relative z-10">
        <div className="relative w-full aspect-[4/3] max-h-40">
          {m.imageUrl ? (
            <Image
              src={m.imageUrl}
              alt={m.name}
              fill
              className="object-contain group-hover:scale-105 transition-transform duration-500 drop-shadow-2xl"
              sizes="(max-width: 768px) 100vw, 33vw"
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

        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 hover:bg-white/[0.05] transition-colors">
            <div className="text-zinc-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Hashrate</div>
            <div className="text-white font-mono text-sm font-bold">
              {m.hashrate} <span className="text-[10px] text-zinc-600 font-normal">{m.hashrateUnit}</span>
            </div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 hover:bg-white/[0.05] transition-colors">
            <div className="text-zinc-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Efficiency</div>
            <div className="text-white font-mono text-sm font-bold">{m.efficiencyLabel}</div>
          </div>
        </div>

        {/* Footer with Gradient Profit */}
        <div className="flex items-end justify-between border-t border-white/5 pt-4">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Best Price</div>
            <div className="text-white font-bold text-lg">
              {m.bestPriceUsd ? m.priceDisplay : <span className="text-zinc-700 text-sm font-normal">No Offer</span>}
            </div>
          </div>
          <div className={cn("text-right pl-6 pr-2 py-1 rounded-l-xl -mr-5", profitBg)}>
            {m.hasRevenueData ? (
              <>
                <div className={`font-bold ${profitColor} text-lg`}>{m.profitDisplay}</div>
                <div className="text-[10px] text-zinc-400 font-medium">Daily Net</div>
              </>
            ) : (
              <span className="text-xs text-zinc-700 italic">No Data</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListCard({ m, selected, onCompare }: { m: EnrichedMiner; selected: boolean; onCompare: () => void }) {
  const isProfitable = (m.profitUsd ?? -1) > 0;
  const profitColor = isProfitable ? "text-emerald-400" : "text-red-400";
  
  const profitBg = isProfitable 
    ? "bg-gradient-to-r from-emerald-500/10 to-transparent" 
    : "bg-gradient-to-r from-red-500/10 to-transparent";

  const cardBorder = isProfitable 
    ? "hover:border-emerald-500/20" 
    : "hover:border-red-500/10";

  return (
    <div className={cn("group relative bg-zinc-900/40 border border-white/5 rounded-2xl lg:p-4 hover:bg-zinc-900/80 transition-all duration-300 hover:shadow-lg backdrop-blur-sm overflow-hidden", cardBorder)}>
      
      {/* Mobile Layout */}
      <div className="block lg:hidden">
        <div className="flex lg:hidden overflow-x-auto no-scrollbar relative w-full items-stretch">
          
          {/* STICKY COLUMN */}
          <div className="sticky left-0 z-10 flex flex-col justify-center min-w-[160px] max-w-[160px] p-4 bg-[#0b0e14] border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
             <div className="mb-2">
               <button
                 onClick={onCompare} 
                 className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-lg border transition-all text-xs mb-3", 
                    selected ? "bg-cyan-500 border-cyan-500 text-black" : "border-white/10 text-zinc-500"
                 )}
               >
                 {selected ? "✓" : "+"}
               </button>
               <Link href={m.machineHref} className="block text-sm font-bold text-white leading-tight hover:text-cyan-400 line-clamp-2">
                 {m.name}
               </Link>
               <div className="text-[10px] text-zinc-500 mt-1 truncate">{m.manufacturerData.displayName}</div>
             </div>
          </div>

          {/* SCROLLABLE COLUMNS */}
          <div className="flex items-center divide-x divide-white/5">
             
             {/* Profit (Priority + Gradient Background) */}
             <div className={cn("flex-shrink-0 w-[130px] p-4 flex flex-col justify-center", profitBg)}>
                <div className="text-[10px] text-zinc-400 uppercase font-bold mb-1">Profit/Day</div>
                {m.hasRevenueData ? (
                   <div className={`text-sm font-bold font-mono ${profitColor}`}>{m.profitDisplay}</div>
                ) : <span className="text-xs text-zinc-600">--</span>}
             </div>

             <div className="flex-shrink-0 w-[120px] p-4 flex flex-col justify-center bg-zinc-900/20">
                <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Price</div>
                <div className="text-sm font-bold text-white">{m.bestPriceUsd ? m.priceDisplay : "—"}</div>
             </div>
             <div className="flex-shrink-0 w-[100px] p-4 flex flex-col justify-center bg-zinc-900/20">
                <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">ROI</div>
                <div className="text-sm font-mono text-zinc-300">{m.roiDays ? `${Math.ceil(m.roiDays)}d` : "—"}</div>
             </div>
             <div className="flex-shrink-0 w-[130px] p-4 flex flex-col justify-center bg-zinc-900/20">
                <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Hashrate</div>
                <div className="text-sm font-mono text-white">{m.hashrate} <span className="text-zinc-500 text-xs">{m.hashrateUnit}</span></div>
             </div>
             <div className="flex-shrink-0 w-[110px] p-4 flex flex-col justify-center bg-zinc-900/20">
                <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Efficiency</div>
                <div className="text-sm font-mono text-zinc-300">{m.efficiencyLabel}</div>
             </div>
             <div className="flex-shrink-0 w-[110px] p-4 flex flex-col justify-center bg-zinc-900/20">
                <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Algo</div>
                <span className="inline-flex px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] font-bold text-zinc-400">{m.algorithm.name}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout (Standard Grid Row) */}
      <div className="hidden lg:grid grid-cols-[50px_3fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 items-center p-4">
        <div>
           <button onClick={onCompare} className={cn("w-6 h-6 flex items-center justify-center rounded-lg border transition-all", selected ? "bg-cyan-500 border-cyan-500 text-black" : "border-zinc-700 text-transparent hover:border-zinc-500")}>✓</button>
        </div>
        <div className="flex items-center gap-4">
           <div className="h-10 w-10 bg-white/5 rounded-lg p-1 border border-white/5 shrink-0">
              {m.imageUrl && <Image src={m.imageUrl} alt={m.name} width={40} height={40} className="object-contain w-full h-full"/>}
           </div>
           <div className="min-w-0">
              <Link href={m.machineHref} className="block font-bold text-white text-sm hover:text-cyan-400 truncate">{m.name}</Link>
              <div className="text-[10px] text-zinc-500 mt-0.5">{m.manufacturerData.displayName}</div>
           </div>
        </div>
        <div className="text-sm font-mono text-zinc-300"><span className="text-white font-bold">{m.hashrate}</span> <span className="text-xs text-zinc-500">{m.hashrateUnit}</span></div>
        <div className="text-sm font-mono text-zinc-300">{m.powerW} <span className="text-xs text-zinc-500">W</span></div>
        <div className="text-sm font-mono text-zinc-400">{m.efficiencyLabel}</div>
        <div><span className="inline-flex items-center rounded bg-white/5 px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border border-white/5">{m.algorithm.name}</span></div>
        <div className="text-right text-sm font-mono">{m.roiDays ? <span className="text-yellow-500 font-bold">{Math.ceil(m.roiDays)}d</span> : <span className="text-zinc-700">—</span>}</div>
        <div className="text-right">{m.bestPriceUsd ? <div className="text-white font-bold text-sm">{m.priceDisplay}</div> : <span className="text-xs text-zinc-600">No Offer</span>}</div>
        <div className={cn("text-right px-2 py-1 rounded-r-lg -mr-2", profitBg)}>
            {m.hasRevenueData ? <div className={`font-bold ${profitColor} text-sm`}>{m.profitDisplay}</div> : <span className="text-xs text-zinc-700">No Data</span>}
        </div>
      </div>
    </div>
  );
}