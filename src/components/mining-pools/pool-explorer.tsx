"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getCoinLogoUrl } from "@/lib/coin-logos";
import type { MiningPoolEntry, PoolKyc, PoolRegion, PayoutMethod } from "@/lib/mining-pools";

type AlgoOpt = { key: string; name: string };
type CoinOpt = { symbol: string; name: string; algorithmKey: string; algorithmName: string };

function clampNum(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function avgFeePct(p: MiningPoolEntry): number | null {
  const f = p.feePct;
  if (!f) return null;
  const min = Number(f.min);
  const max = Number(f.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return (min + max) / 2;
}

function hasMethod(p: MiningPoolEntry, m: string) {
  return p.payoutMethods.map((x) => String(x).toUpperCase()).includes(String(m).toUpperCase());
}

function regionLabel(r: PoolRegion) {
  switch (r) {
    case "NA": return "N. America";
    case "EU": return "Europe";
    case "ASIA": return "Asia";
    default: return "Global";
  }
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/** * Reusable stylized chip toggle 
 */
function FilterChip({ 
  label, 
  active, 
  onClick 
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 border",
        active
          ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_-3px_rgba(6,182,212,0.3)]"
          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
      )}
    >
      {label}
    </button>
  );
}

/**
 * Custom styled select wrapper
 */
function SelectWrapper({ 
  label, 
  children 
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      <label className="absolute -top-2 left-3 bg-zinc-900 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-focus-within:text-cyan-500">
        {label}
      </label>
      <div className="relative">
        {children}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function PoolExplorer({
  pools,
  algorithms,
  coins,
  initial,
}: {
  pools: MiningPoolEntry[];
  algorithms: AlgoOpt[];
  coins: CoinOpt[];
  initial?: { algorithmKey?: string; coinSymbol?: string };
}) {
  const [q, setQ] = useState("");
  const [algorithmKey, setAlgorithmKey] = useState(initial?.algorithmKey ?? "");
  const [coinSymbol, setCoinSymbol] = useState(initial?.coinSymbol ?? "");
  const [method, setMethod] = useState<string>("");
  const [region, setRegion] = useState<PoolRegion | "">("");
  const [kyc, setKyc] = useState<PoolKyc | "">("");
  const [accountRequired, setAccountRequired] = useState<"" | "yes" | "no">("");
  const [sort, setSort] = useState<"recommended" | "lowestFee" | "beginner" | "decentralization">("recommended");

  // priorities
  const [prioSmooth, setPrioSmooth] = useState(true);
  const [prioLowFees, setPrioLowFees] = useState(false);
  const [prioDecent, setPrioDecent] = useState(false);
  const [prioNoAcct, setPrioNoAcct] = useState(false);
  const [prioNoKyc, setPrioNoKyc] = useState(false);

  // fee impact
  const [grossUsdPerDay, setGrossUsdPerDay] = useState(100);

  const coinsByAlgorithm = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of coins) {
      const key = String(c.algorithmKey || "").trim();
      if (!key) continue;
      const prev = m.get(key) ?? [];
      const sym = String(c.symbol).toUpperCase();
      if (!prev.includes(sym)) m.set(key, [...prev, sym]);
    }
    return m;
  }, [coins]);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    const coin = coinSymbol.trim().toUpperCase();
    const algo = algorithmKey.trim();
    const algoCoins = algo ? new Set(coinsByAlgorithm.get(algo) ?? []) : null;

    const out = pools.filter((p) => {
      if (qn) {
        const hay = `${p.name} ${p.notes} ${(p.coins || []).join(" ")} ${(p.payoutMethods || []).join(" ")}`.toLowerCase();
        if (!hay.includes(qn)) return false;
      }
      if (coin) {
        if (!(p.coins || []).map((x) => String(x).toUpperCase()).includes(coin)) return false;
      } else if (algoCoins) {
        const pCoins = (p.coins || []).map((x) => String(x).toUpperCase());
        if (!pCoins.some((s) => algoCoins.has(s))) return false;
      }
      if (method && !hasMethod(p, method)) return false;
      if (region && !(p.regions || []).includes(region)) return false;
      if (kyc && (p.kyc ?? "unknown") !== kyc) return false;
      if (accountRequired === "yes" && !p.accountRequired) return false;
      if (accountRequired === "no" && p.accountRequired) return false;
      return true;
    });

    function score(p: MiningPoolEntry) {
      let s = 0;
      if (p.bestFor?.includes("beginner")) s += 2;
      if (p.bestFor?.includes("transparent")) s += 1;
      if (p.bestFor?.includes("proOps")) s += 1;
      if (p.bestFor?.includes("decentralization")) s += 1;
      if (method && hasMethod(p, method)) s += 2;
      if (prioSmooth) {
        if (p.bestFor?.includes("lowVariance")) s += 2;
        if (p.payoutMethods.some((m) => ["PPS", "FPPS"].includes(String(m).toUpperCase()))) s += 1;
      }
      if (prioLowFees) {
        const a = avgFeePct(p);
        if (a != null) s += clampNum(3 - a, -2, 3);
      }
      if (prioDecent) {
        if (p.bestFor?.includes("decentralization")) s += 3;
        if (p.bestFor?.includes("altcoins") && !p.bestFor?.includes("decentralization")) s -= 1;
      }
      if (prioNoAcct) {
        if (p.accountRequired) s -= 3; else s += 2;
      }
      if (prioNoKyc) {
        if (p.kyc === "none") s += 2;
        if (p.kyc === "required") s -= 2;
      }
      const a = avgFeePct(p);
      if (a != null) s += clampNum(2 - a / 2, -2, 2);
      if (region && p.regions.includes(region)) s += 1;
      if (coin && p.coins.map((x) => String(x).toUpperCase()).includes(coin)) s += 1;
      if (p.cautions?.length) s -= 0.5;
      return s;
    }

    return [...out].sort((a, b) => {
      if (sort === "lowestFee") {
        const af = avgFeePct(a), bf = avgFeePct(b);
        if (af == null && bf == null) return score(b) - score(a);
        if (af == null) return 1;
        if (bf == null) return -1;
        return af - bf;
      }
      if (sort === "beginner") {
        const ab = a.bestFor?.includes("beginner") ? 1 : 0;
        const bb = b.bestFor?.includes("beginner") ? 1 : 0;
        if (ab !== bb) return bb - ab;
      }
      if (sort === "decentralization") {
        const ad = a.bestFor?.includes("decentralization") ? 1 : 0;
        const bd = b.bestFor?.includes("decentralization") ? 1 : 0;
        if (ad !== bd) return bd - ad;
      }
      return score(b) - score(a);
    });
  }, [q, pools, algorithmKey, coinSymbol, method, region, kyc, accountRequired, sort, coinsByAlgorithm, prioSmooth, prioLowFees, prioDecent, prioNoAcct, prioNoKyc]);

  const topPicks = filtered.slice(0, 3);

  const feeNet = useMemo(() => {
    const g = Number(grossUsdPerDay);
    if (!Number.isFinite(g) || g <= 0) return null;
    const fees = topPicks.map((p) => ({ p, fee: avgFeePct(p) })).filter((x) => x.fee != null) as Array<{ p: MiningPoolEntry; fee: number }>;
    return fees.map((x) => ({ id: x.p.id, name: x.p.name, fee: x.fee, net: g * (1 - x.fee / 100) }));
  }, [grossUsdPerDay, topPicks]);

  const algoOptions = [{ key: "", name: "All Algorithms" }, ...algorithms];
  const coinOptions = useMemo(() => {
    const a = algorithmKey.trim();
    const filteredCoins = a ? coins.filter((c) => c.algorithmKey === a) : coins;
    return [{ symbol: "", name: "All Coins" }, ...[...filteredCoins].sort((x, y) => x.symbol.localeCompare(y.symbol))];
  }, [coins, algorithmKey]);

  return (
    <div className="space-y-8">
      {/* 1. CONTROL PANEL */}
      <div className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-6">
          
          {/* Top Row: Search + Main Selects */}
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <SelectWrapper label="Search">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filter by name, note, coin..."
                  className="w-full h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all"
                />
              </SelectWrapper>
            </div>
            <div className="lg:col-span-4">
              <SelectWrapper label="Coin">
                <select
                  value={coinSymbol}
                  onChange={(e) => setCoinSymbol(e.target.value)}
                  className="w-full h-12 appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-300 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all cursor-pointer"
                >
                  {coinOptions.map((c) => (
                    <option key={c.symbol || "all"} value={c.symbol} className="bg-zinc-900 text-zinc-300">
                      {c.symbol ? `${c.symbol} ${c.name ? `— ${c.name}` : ""}` : "All Coins"}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>
            <div className="lg:col-span-4">
               <SelectWrapper label="Algorithm">
                <select
                  value={algorithmKey}
                  onChange={(e) => {
                    setAlgorithmKey(e.target.value);
                    if (e.target.value) {
                      const allowed = new Set(coinsByAlgorithm.get(e.target.value) ?? []);
                      if (coinSymbol && !allowed.has(coinSymbol.toUpperCase())) setCoinSymbol("");
                    }
                  }}
                  className="w-full h-12 appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-300 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all cursor-pointer"
                >
                  {algoOptions.map((a) => (
                    <option key={a.key || "all"} value={a.key} className="bg-zinc-900 text-zinc-300">
                      {a.name}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Middle Row: Refinements & Priorities */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            
            {/* Secondary Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="w-32">
                <SelectWrapper label="Payout">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full h-10 appearance-none rounded-lg border border-white/10 bg-zinc-900 px-3 text-xs text-zinc-300 outline-none"
                  >
                    <option value="" className="bg-zinc-900 text-zinc-300">Any</option>
                    <option value="FPPS" className="bg-zinc-900 text-zinc-300">FPPS</option>
                    <option value="PPS" className="bg-zinc-900 text-zinc-300">PPS</option>
                    <option value="PPLNS" className="bg-zinc-900 text-zinc-300">PPLNS</option>
                    <option value="SOLO" className="bg-zinc-900 text-zinc-300">SOLO</option>
                  </select>
                </SelectWrapper>
              </div>
              <div className="w-32">
                <SelectWrapper label="Region">
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as any)}
                    className="w-full h-10 appearance-none rounded-lg border border-white/10 bg-zinc-900 px-3 text-xs text-zinc-300 outline-none"
                  >
                    <option value="" className="bg-zinc-900 text-zinc-300">Any</option>
                    <option value="GLOBAL" className="bg-zinc-900 text-zinc-300">Global</option>
                    <option value="NA" className="bg-zinc-900 text-zinc-300">North America</option>
                    <option value="EU" className="bg-zinc-900 text-zinc-300">Europe</option>
                    <option value="ASIA" className="bg-zinc-900 text-zinc-300">Asia</option>
                  </select>
                </SelectWrapper>
              </div>
            </div>

            {/* Priorities (Chips) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mr-1">Prioritize:</span>
              <FilterChip label="Smooth Payouts" active={prioSmooth} onClick={() => setPrioSmooth(!prioSmooth)} />
              <FilterChip label="Lowest Fees" active={prioLowFees} onClick={() => setPrioLowFees(!prioLowFees)} />
              <FilterChip label="Decentralization" active={prioDecent} onClick={() => setPrioDecent(!prioDecent)} />
              <FilterChip label="No Account" active={prioNoAcct} onClick={() => setPrioNoAcct(!prioNoAcct)} />
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP PICKS & CALCULATOR */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Top Picks Cards */}
        <div className="lg:col-span-8 space-y-4">
           <div className="flex items-center justify-between px-1">
             <h3 className="text-lg font-semibold text-white">Recommended Pools</h3>
             <span className="text-xs text-zinc-500">Sorted by relevance to your filters</span>
           </div>

           <div className="grid gap-4 md:grid-cols-3">
             {topPicks.map((p, idx) => {
               const fee = avgFeePct(p);
               const isBest = idx === 0;
               return (
                 <div 
                   key={p.id} 
                   className={cn(
                     "relative flex flex-col justify-between rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-lg",
                     isBest ? "border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 to-zinc-900/80" : "border-white/10 bg-zinc-900/50"
                   )}
                 >
                   {isBest && <div className="absolute -top-3 right-4 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-lg shadow-cyan-500/20">Top Match</div>}
                   
                   <div>
                     <div className="flex items-start justify-between">
                       <h4 className="font-bold text-white truncate pr-2">{p.name}</h4>
                       <a href={p.websiteUrl} target="_blank" className="text-zinc-500 hover:text-white">↗</a>
                     </div>
                     <div className="mt-2 flex flex-wrap gap-1">
                        {(p.coins || []).slice(0, 3).map(c => (
                          <span key={c} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">{c}</span>
                        ))}
                     </div>
                     <p className="mt-3 text-xs text-zinc-400 line-clamp-2 leading-relaxed">{p.notes}</p>
                   </div>

                   <div className="mt-4 pt-4 border-t border-white/5 flex items-end justify-between">
                      <div>
                        <div className="text-[10px] uppercase text-zinc-500">Fee</div>
                        <div className="text-sm font-mono text-zinc-200">{fee != null ? `${fee}%` : "—"}</div>
                      </div>
                      <div className="text-right">
                         <div className="text-[10px] uppercase text-zinc-500">Payout</div>
                         <div className="text-sm font-medium text-cyan-400">{p.payoutMethods[0]}</div>
                      </div>
                   </div>
                 </div>
               )
             })}
             {topPicks.length === 0 && (
                <div className="col-span-3 rounded-2xl border border-dashed border-white/20 p-8 text-center text-zinc-500">
                  No pools match your exact filters. Try relaxing the region or account requirements.
                </div>
             )}
           </div>
        </div>

        {/* Profit Calculator */}
        <div className="lg:col-span-4 flex flex-col h-full">
           <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 flex-1">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-white">Fee Impact</h4>
                <p className="text-xs text-zinc-500">Estimate daily net revenue after pool fees.</p>
              </div>
              
              <div className="relative mb-6">
                <label className="text-[10px] font-bold uppercase text-zinc-500">Gross Revenue (USD/Day)</label>
                <input
                  type="number"
                  value={grossUsdPerDay}
                  onChange={(e) => setGrossUsdPerDay(Number(e.target.value))}
                  className="mt-1 w-full border-b border-white/20 bg-transparent py-2 text-2xl font-bold text-white outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                {feeNet?.length ? feeNet.map((x) => (
                  <div key={x.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className="text-zinc-300">{x.name}</span>
                    <span className="font-mono font-medium text-green-400">${x.net.toFixed(2)}</span>
                  </div>
                )) : <div className="text-xs text-zinc-600 italic">Select filters to see estimates.</div>}
              </div>
           </div>
        </div>
      </div>

      {/* 3. RESULTS TABLE */}
      <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-1">
         <div className="overflow-x-auto rounded-3xl">
           <table className="w-full border-separate border-spacing-y-1">
             <thead className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
               <tr>
                 <th className="px-6 py-4 text-left">Pool Name</th>
                 <th className="px-4 py-4 text-left">Coins</th>
                 <th className="px-4 py-4 text-left">Model</th>
                 <th className="px-4 py-4 text-right">Fee</th>
                 <th className="px-4 py-4 text-left">Region</th>
                 <th className="px-4 py-4 text-left hidden lg:table-cell">Notes</th>
               </tr>
             </thead>
             <tbody className="text-sm">
               {filtered.map(p => {
                 const fee = avgFeePct(p);
                 return (
                   <tr key={p.id} className="group bg-zinc-900/60 hover:bg-zinc-800/80 transition-colors">
                     <td className="rounded-l-2xl border-y border-l border-white/5 px-6 py-4">
                       <a href={p.websiteUrl} target="_blank" className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                         {p.name}
                       </a>
                       {p.cautions?.length ? (
                         <div className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
                           <span>⚠</span> {p.cautions[0]}
                         </div>
                       ) : null}
                     </td>
                     <td className="border-y border-white/5 px-4 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {p.coins.slice(0,4).map(c => (
                            <span key={c} className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-zinc-400">{c}</span>
                          ))}
                          {p.coins.length > 4 && <span className="text-[10px] text-zinc-600">+{p.coins.length-4}</span>}
                        </div>
                     </td>
                     <td className="border-y border-white/5 px-4 py-4">
                        <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                          {p.payoutMethods[0]}
                        </span>
                     </td>
                     <td className="border-y border-white/5 px-4 py-4 text-right font-mono text-zinc-300">
                       {fee != null ? `${fee}%` : "—"}
                     </td>
                     <td className="border-y border-white/5 px-4 py-4">
                        <div className="text-xs text-zinc-400">
                          {p.regions.map(regionLabel).slice(0,2).join(", ")}
                          {p.regions.length > 2 && "..."}
                        </div>
                     </td>
                     <td className="rounded-r-2xl border-y border-r border-white/5 px-4 py-4 hidden lg:table-cell">
                        <div className="text-xs text-zinc-500 line-clamp-1 max-w-xs">{p.notes}</div>
                     </td>
                   </tr>
                 )
               })}
             </tbody>
           </table>
           {!filtered.length && (
             <div className="p-12 text-center text-zinc-500">No matching pools found.</div>
           )}
         </div>
      </div>
    </div>
  );
}