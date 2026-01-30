"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";

export type WhatIfPoint = {
  rate: number;
  profitUsd: number | null;
  profitDisplay: string;
  profitable: boolean;
};

export type CompareTrayItem = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;

  algorithmName: string;

  hashrate: string;
  hashrateUnit: string;
  powerW: number;

  revenueDisplay: string;
  elecDisplay: string;
  profitDisplay: string;

  isProfitable: boolean;

  roiDays: number | null;
  priceDisplay: string;

  efficiencyLabel: string;

  breakEvenRate: number | null; // USD/kWh
  offerCount: number;

  bestCoin: string | null;

  snapshotNetProfitUsdPerDay?: number | null; 
  snapshotBaselineElectricityUsdPerKwh?: number | null; 
  snapshotComputedAt?: string | Date | null;

  whatIf?: WhatIfPoint[];
};

type Props = {
  items?: CompareTrayItem[];
  maxCompare?: number;
};

function clampArr<T>(arr: T[] | undefined, max: number) {
  if (!arr) return [];
  return arr.slice(0, max);
}

function safeNum(n: unknown) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function kwhPerDayFromPowerW(powerW: number) {
  const w = Math.max(0, Number(powerW) || 0);
  return (w / 1000) * 24;
}

function profitAtRate(params: {
  snapNetProfitUsdPerDay: number | null | undefined;
  snapBaselineElectricityUsdPerKwh: number | null | undefined;
  powerW: number;
  targetElectricityUsdPerKwh: number;
}) {
  const { snapNetProfitUsdPerDay, snapBaselineElectricityUsdPerKwh, powerW, targetElectricityUsdPerKwh } = params;

  const baseProfit = safeNum(snapNetProfitUsdPerDay);
  if (baseProfit == null) return null;

  const baseElec = safeNum(snapBaselineElectricityUsdPerKwh);
  const kwhDay = kwhPerDayFromPowerW(powerW);

  if (kwhDay <= 0) return baseProfit;
  if (baseElec == null) return baseProfit; 

  const delta = (targetElectricityUsdPerKwh - baseElec) * kwhDay;
  return baseProfit - delta;
}

function currencyFormatter(currency: string) {
  const cur = (currency || "USD").toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 2,
  });
}

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export function CompareTray({ items, maxCompare = 5 }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentCompareIds = useMemo(() => {
      const raw = sp.get("compare");
      if(!raw) return new Set<string>();
      return new Set(raw.split(",").map(x => x.trim()).filter(Boolean));
  }, [sp]);

  // Filter items based on what's in the URL
  const rows = useMemo(() => {
      if(!items) return [];
      return items.filter(i => currentCompareIds.has(i.id)).slice(0, maxCompare);
  }, [items, currentCompareIds, maxCompare]);

  const compareIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const canOpenCompare = compareIds.length >= 2;

  const currency = useMemo(() => {
    const c = (sp.get("currency") ?? "USD").toUpperCase();
    return c || "USD";
  }, [sp]);

  const fmt = useMemo(() => currencyFormatter(currency), [currency]);

  const whatIfRates = useMemo(() => {
    const set = new Set<number>();
    const base = [0.05, 0.1, 0.15];
    base.forEach((x) => set.add(x));
    return Array.from(set).sort((a, b) => a - b).slice(0, 3);
  }, []);

  function remove(id: string) {
    const next = new URLSearchParams(sp.toString());
    const current = (next.get("compare") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const filtered = current.filter((x) => x !== id);
    if (filtered.length) next.set("compare", filtered.join(","));
    else next.delete("compare");

    startTransition(() => router.push(`?${next.toString()}`, { scroll: false }));
  }

  function clearAll() {
    const next = new URLSearchParams(sp.toString());
    next.delete("compare");
    startTransition(() => router.push(`?${next.toString()}`, { scroll: false }));
  }

  function openComparePage() {
    if (!canOpenCompare) return;
    const ids = encodeURIComponent(compareIds.join(","));
    startTransition(() => router.push(`/compare?ids=${ids}`));
  }

  if (!rows.length) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] md:left-10 md:right-10 lg:left-auto lg:right-10 lg:w-[600px] xl:w-[800px]">
      <div className="rounded-3xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/5 transition-all animate-in slide-in-from-bottom-10 fade-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-black shadow-lg shadow-cyan-500/20">
              {rows.length}
            </span>
            <span className="text-sm font-bold text-white">Comparison Deck</span>
          </div>

          <div className="flex items-center gap-4">
            {isPending && (
              <span className="flex items-center gap-2 text-[10px] font-bold text-cyan-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"/>
                SYNCING
              </span>
            )}
            <button
              onClick={clearAll}
              className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wider"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Selected Items Strip */}
        <div className="px-2 py-2 flex gap-2 overflow-x-auto border-b border-white/5 no-scrollbar bg-black/20">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/50 pl-2 pr-3 py-2 shrink-0 min-w-[160px]"
            >
              <div className="h-8 w-8 rounded-lg bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center p-1">
                {r.imageUrl ? (
                  <Image
                    src={r.imageUrl}
                    alt={r.name}
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-[10px] opacity-30">IMG</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-white truncate leading-tight mb-0.5">{r.name}</div>
                <div className="text-[9px] text-zinc-500 font-mono truncate">{r.profitDisplay}/day</div>
              </div>

              <button
                onClick={() => remove(r.id)}
                className="h-5 w-5 flex items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* What-If Table (Mini Financial) */}
        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur z-10 text-[9px] font-bold uppercase tracking-widest text-zinc-500 border-b border-white/5">
              <tr>
                <th className="px-5 py-2 w-24">Scenario</th>
                {rows.map(r => (
                    <th key={r.id} className="px-3 py-2 text-right truncate max-w-[80px] text-zinc-400">{r.name.split(" ")[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono">
                {/* Break Even Row */}
                <tr>
                    <td className="px-5 py-2 text-zinc-400 font-sans text-[10px] font-bold">Break-Even</td>
                    {rows.map(r => (
                        <td key={r.id} className="px-3 py-2 text-right text-zinc-300">
                            {r.breakEvenRate ? `$${r.breakEvenRate.toFixed(3)}` : "—"}
                        </td>
                    ))}
                </tr>
                {/* What If Rows */}
                {whatIfRates.map(rate => (
                    <tr key={rate} className="group hover:bg-white/[0.02]">
                        <td className="px-5 py-2 text-zinc-500 group-hover:text-cyan-400 transition-colors">
                            @ ${rate.toFixed(2)}/kWh
                        </td>
                        {rows.map(r => {
                             const profitUsd = profitAtRate({
                                snapNetProfitUsdPerDay: r.snapshotNetProfitUsdPerDay,
                                snapBaselineElectricityUsdPerKwh: r.snapshotBaselineElectricityUsdPerKwh,
                                powerW: r.powerW,
                                targetElectricityUsdPerKwh: rate,
                              });
                              const isProfitable = (profitUsd ?? 0) > 0;
                              const display = profitUsd == null ? "—" : fmt.format(profitUsd);
                              
                              return (
                                  <td key={r.id} className={cn(
                                      "px-3 py-2 text-right font-bold transition-colors",
                                      isProfitable ? "text-emerald-400" : "text-red-400"
                                  )}>
                                      {display}
                                  </td>
                              )
                        })}
                    </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-zinc-900/50 border-t border-white/5 flex gap-2">
            <button
                onClick={openComparePage}
                disabled={!canOpenCompare}
                className={cn(
                    "flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all",
                    canOpenCompare
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 hover:scale-[1.02]"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
            >
                {canOpenCompare ? "Launch Full Comparison" : `Select ${2 - rows.length} more`}
            </button>
        </div>

      </div>
    </div>
  );
}

export default CompareTray;