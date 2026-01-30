"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Wallet = {
  id: string;
  name: string;
  brand: string;
  tagline: string;
  logo?: string;
  focus: "Bitcoin-only" | "Multi-asset";
  connections: Array<"USB-C" | "USB" | "Bluetooth" | "QR" | "microSD">;
  openSource: "Yes" | "Partial" | "No";
  secureElement: "Yes" | "No" | "Varies";
  priceTier: "$" | "$$" | "$$$";
  bestFor: string[];
  highlights: string[];
  officialUrl: string;
  notes?: string;
};

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** * stylized pill for tags 
 */
function TechBadge({ 
  label, 
  tone = "default" 
}: { 
  label: string; 
  tone?: "cyan" | "orange" | "purple" | "default" | "green" 
}) {
  const styles = {
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    default: "bg-white/5 text-zinc-400 border-white/10",
  };

  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider", styles[tone])}>
      {label}
    </span>
  );
}

/** * Custom Select Component style 
 */
function SelectWrapper({ 
  value, 
  onChange, 
  options, 
  label 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  options: string[]; 
  label: string 
}) {
  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <span className="text-[10px] font-bold uppercase text-zinc-500 mr-2">{label}:</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pl-[4.5rem] pr-8 w-full bg-black/20 border border-white/10 rounded-xl text-sm text-zinc-200 outline-none appearance-none focus:border-cyan-500/50 hover:bg-white/5 transition-all cursor-pointer font-medium"
      >
        <option value="ALL" className="bg-zinc-900">Any</option>
        {options.map(o => (
          <option key={o} value={o} className="bg-zinc-900">{o}</option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-600">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </div>
  );
}

export function HardwareWalletsClient({ wallets }: { wallets: Wallet[] }) {
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<"ALL" | Wallet["focus"]>("ALL");
  const [conn, setConn] = useState<"ALL" | Wallet["connections"][number]>("ALL");
  const [open, setOpen] = useState<"ALL" | Wallet["openSource"]>("ALL");
  const [se, setSe] = useState<"ALL" | Wallet["secureElement"]>("ALL");
  const [compareOnly, setCompareOnly] = useState(false);

  const [compare, setCompare] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return wallets
      .filter((w) => {
        if (!q) return true;
        const hay = `${w.name} ${w.brand} ${w.tagline} ${w.bestFor.join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .filter((w) => (focus === "ALL" ? true : w.focus === focus))
      .filter((w) => (conn === "ALL" ? true : w.connections.includes(conn)))
      .filter((w) => (open === "ALL" ? true : w.openSource === open))
      .filter((w) => (se === "ALL" ? true : w.secureElement === se))
      .filter((w) => (compareOnly ? compare.includes(w.id) : true));
  }, [wallets, query, focus, conn, open, se, compareOnly, compare]);

  const compareWallets = useMemo(() => {
    const map = new Map(wallets.map((w) => [w.id, w] as const));
    return compare.map((id) => map.get(id)).filter(Boolean) as Wallet[];
  }, [compare, wallets]);

  function toggleCompare(id: string) {
    setCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; 
      return [...prev, id];
    });
  }

  const connectionOptions = ["USB-C", "USB", "Bluetooth", "QR", "microSD"];

  return (
    <div className="space-y-8">
      
      {/* 1. COMMAND CENTER */}
      <div className="sticky top-4 z-40 rounded-3xl border border-white/10 bg-zinc-900/80 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search model, feature, or brand..."
              className="w-full h-10 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="w-40">
              <SelectWrapper label="Focus" value={focus} onChange={(v) => setFocus(v as any)} options={["Bitcoin-only", "Multi-asset"]} />
            </div>
            <div className="w-40">
              <SelectWrapper label="Conn" value={conn} onChange={(v) => setConn(v as any)} options={connectionOptions} />
            </div>
            
            {/* Desktop Only Extra Filters */}
            <div className="hidden xl:block w-36">
              <SelectWrapper label="Open" value={open} onChange={(v) => setOpen(v as any)} options={["Yes", "Partial", "No"]} />
            </div>

            <div className="h-8 w-px bg-white/10 mx-2 hidden lg:block" />

            <button
              onClick={() => setCompareOnly(!compareOnly)}
              className={cn(
                "h-10 px-4 rounded-xl text-xs font-bold uppercase tracking-wide border transition-all",
                compareOnly 
                  ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400" 
                  : "bg-black/20 border-white/10 text-zinc-400 hover:text-white"
              )}
            >
              Compare {compare.length > 0 && `(${compare.length})`}
            </button>

            <button
              onClick={() => { setQuery(""); setFocus("ALL"); setConn("ALL"); setOpen("ALL"); setSe("ALL"); setCompareOnly(false); }}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
              title="Reset"
            >
              ↺
            </button>
          </div>
        </div>
      </div>

      {/* 2. COMPARISON DECK (Conditional) */}
      {compareWallets.length > 0 && (
        <section className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="rounded-[2rem] border border-cyan-500/20 bg-gradient-to-b from-cyan-950/20 to-zinc-950/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 text-lg">⚖️</span>
                <h3 className="text-lg font-bold text-white">Comparison Deck</h3>
              </div>
              <button onClick={() => setCompare([])} className="text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-wide">
                Clear All
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {compareWallets.map((w) => (
                <div key={w.id} className="relative rounded-3xl border border-white/10 bg-black/40 p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{w.brand}</div>
                      <div className="text-xl font-black text-white">{w.name}</div>
                    </div>
                    <button onClick={() => toggleCompare(w.id)} className="text-zinc-600 hover:text-white transition-colors">×</button>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-zinc-500">Price Tier</span>
                      <span className="text-white font-mono">{w.priceTier}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-zinc-500">Focus</span>
                      <span className={w.focus === "Bitcoin-only" ? "text-orange-400" : "text-cyan-400"}>{w.focus}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-zinc-500">Open Source</span>
                      <span className={w.openSource === "Yes" ? "text-emerald-400" : "text-zinc-300"}>{w.openSource}</span>
                    </div>
                    <div className="pt-2">
                      <div className="text-xs text-zinc-500 mb-2">Connectivity</div>
                      <div className="flex flex-wrap gap-1.5">
                        {w.connections.map(c => <span key={c} className="px-2 py-1 rounded bg-white/5 text-[10px] text-zinc-300 border border-white/5">{c}</span>)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. MAIN GRID */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-zinc-500">
          Showing <strong className="text-white">{filtered.length}</strong> wallets
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((w) => {
          const isSelected = compare.includes(w.id);
          const focusColor = w.focus === "Bitcoin-only" ? "orange" : "cyan";

          return (
            <div
              key={w.id}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
                isSelected 
                  ? "border-cyan-500/50 bg-zinc-900/80 shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)]" 
                  : "border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-white/10"
              )}
            >
              {/* Card Header */}
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-2xl shadow-inner">
                    {w.logo ? <Image src={w.logo} alt={w.name} width={32} height={32} /> : "🔐"}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{w.brand}</div>
                    <div className="font-mono text-zinc-300">{w.priceTier}</div>
                  </div>
                </div>

                <h3 className="text-xl font-black text-white mb-2 group-hover:text-cyan-400 transition-colors">{w.name}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[40px] line-clamp-2">{w.tagline}</p>

                {/* Tech Specs */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <TechBadge label={w.focus} tone={focusColor} />
                  <TechBadge label={w.secureElement === "Yes" ? "SE: Yes" : "SE: No"} />
                  {w.openSource === "Yes" && <TechBadge label="Open Src" tone="green" />}
                </div>

                {/* Connections */}
                <div className="mt-4 flex flex-wrap gap-1.5 opacity-80">
                  {w.connections.map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-500 border border-white/5 bg-black/20 uppercase">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer / Actions */}
              <div className="mt-6 pt-5 border-t border-white/5">
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-2">Best For</span>
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {w.bestFor.slice(0, 2).map((b) => (
                      <span key={b} className="text-xs text-zinc-300 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-cyan-500" /> {b}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => toggleCompare(w.id)}
                    className={cn(
                      "h-10 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors border",
                      isSelected
                        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                        : "bg-transparent border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {isSelected ? "Selected" : "Compare"}
                  </button>
                  <a
                    href={w.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center h-10 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-wide hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
                  >
                    Visit Site
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. SECURITY PROTOCOL FOOTER */}
      <section className="mt-16 rounded-[2.5rem] border border-white/5 bg-[#050505] p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white mb-2">Security Protocol</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              Buying the wallet is only step one. How you initialize it determines your actual security. Follow this strict protocol to prevent supply chain attacks and user error.
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase">Never type seed online</div>
              <div className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase">Check tamper seals</div>
            </div>
          </div>
          
          <div className="flex-1 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-4">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">01. Verification</div>
              <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside marker:text-cyan-500">
                <li>Buy direct from manufacturer</li>
                <li>Verify firmware signature</li>
                <li>Check for physical tampering</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-4">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">02. Setup</div>
              <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside marker:text-emerald-500">
                <li>Write seed on paper/steel only</li>
                <li>Update firmware immediately</li>
                <li>Test wipe & restore once</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}