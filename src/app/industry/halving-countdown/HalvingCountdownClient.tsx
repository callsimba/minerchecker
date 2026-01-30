"use client";

import React, { useEffect, useMemo, useState } from "react";

type BtcInitial = {
  tipHeight: number | null;
  nextHalvingHeight: number;
  avgBlockSeconds: number;
  secondsRemainingEstimate: number | null;
};

export type HalvingInitial = {
  btc: BtcInitial;
};

type ApiResp = {
  tipHeight: number | null;
  nextHalvingHeight: number;
  avgBlockSeconds: number;
  blocksRemaining: number | null;
  secondsRemainingEstimate: number | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatInt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function formatFloat(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
}

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hrs = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return { days, hrs, mins, secs };
}

/** * Modern Glass Stat Card */
function GlowStat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "cyan" | "orange";
}) {
  const styles = {
    default: "border-white/5 bg-zinc-900/40 text-zinc-300",
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400 shadow-[0_0_20px_-10px_rgba(6,182,212,0.3)]",
    orange: "border-orange-500/20 bg-orange-500/5 text-orange-400 shadow-[0_0_20px_-10px_rgba(249,115,22,0.3)]",
  };

  return (
    <div className={`rounded-3xl border p-5 backdrop-blur-sm transition-all hover:-translate-y-1 ${styles[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-black tracking-tight text-white">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-60 font-mono">{sub}</div>}
    </div>
  );
}

/** * Circular Progress Indicator */
function ProgressRing({ pct }: { pct: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamp(pct, 0, 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#27272a" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#f59e0b" // Amber-500
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-black text-white">{pct.toFixed(1)}%</span>
        <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider">Complete</span>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  setValue,
  unit,
  step,
  min,
  max
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  unit?: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="group relative rounded-2xl bg-black/20 border border-white/5 p-3 hover:bg-black/30 hover:border-white/10 transition-all">
      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 group-focus-within:text-cyan-400 transition-colors">
        {label}
      </label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          step={step}
          min={min}
          max={max}
          className="w-full bg-transparent font-mono text-lg font-bold text-white outline-none placeholder-zinc-700"
        />
        {unit && <span className="text-xs font-bold text-zinc-600">{unit}</span>}
      </div>
    </div>
  );
}

export default function HalvingCountdownClient({ initial }: { initial: HalvingInitial }) {
  const nextHalvingHeight = initial?.btc?.nextHalvingHeight ?? 1_050_000;

  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    typeof initial?.btc?.secondsRemainingEstimate === "number"
      ? Math.max(0, initial.btc.secondsRemainingEstimate)
      : null
  );

  const [tipHeight, setTipHeight] = useState<number | null>(initial?.btc?.tipHeight ?? null);
  const [avgBlockSeconds, setAvgBlockSeconds] = useState<number>(initial?.btc?.avgBlockSeconds ?? 600);

  // Impact model inputs
  const [btcPrice, setBtcPrice] = useState<number>(65000);
  const [hashrateTh, setHashrateTh] = useState<number>(200);
  const [powerW, setPowerW] = useState<number>(3500);
  const [electricity, setElectricity] = useState<number>(0.10);
  const [poolFeePct, setPoolFeePct] = useState<number>(2);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s == null) return s;
        return Math.max(0, s - 1);
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const res = await fetch("/api/btc/halving", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ApiResp;
        if (!alive) return;

        if (typeof data.avgBlockSeconds === "number" && Number.isFinite(data.avgBlockSeconds)) {
          setAvgBlockSeconds(data.avgBlockSeconds);
        }
        if (data.tipHeight != null && Number.isFinite(data.tipHeight)) {
          setTipHeight(data.tipHeight);
        }
        if (typeof data.secondsRemainingEstimate === "number" && Number.isFinite(data.secondsRemainingEstimate)) {
          const est = Math.max(0, data.secondsRemainingEstimate);
          setSecondsLeft((prev) => {
            if (prev == null) return est;
            if (prev === 0 && est > 0) return est;
            return Math.min(prev, est);
          });
        }
      } catch {}
    }
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const blocksRemaining = useMemo(() => {
    if (tipHeight == null) return null;
    return Math.max(0, nextHalvingHeight - tipHeight);
  }, [tipHeight, nextHalvingHeight]);

  useEffect(() => {
    if (blocksRemaining == null) return;
    const est = Math.max(0, Math.round(blocksRemaining * (avgBlockSeconds || 600)));
    setSecondsLeft((prev) => {
      if (prev == null) return est;
      if (prev === 0 && est > 0) return est;
      return Math.min(prev, est);
    });
  }, [blocksRemaining, avgBlockSeconds]);

  const t = useMemo(() => {
    if (secondsLeft == null) return null;
    return formatDuration(secondsLeft);
  }, [secondsLeft]);

  // Model logic
  const currentReward = 3.125;
  const nextReward = 1.5625;
  const dailyBtcIssuedNow = 144 * currentReward;
  const dailyBtcIssuedAfter = 144 * nextReward;
  const assumedNetworkTh = 700_000_000;
  const minerShare = Math.max(0, hashrateTh) / assumedNetworkTh;
  const grossBtcPerDayNow = dailyBtcIssuedNow * minerShare;
  const grossBtcPerDayAfter = dailyBtcIssuedAfter * minerShare;
  const grossUsdNow = grossBtcPerDayNow * btcPrice;
  const grossUsdAfter = grossBtcPerDayAfter * btcPrice;
  const feeMultiplier = 1 - clamp(poolFeePct, 0, 20) / 100;
  const netUsdNow = grossUsdNow * feeMultiplier;
  const netUsdAfter = grossUsdAfter * feeMultiplier;
  const kWhPerDay = (Math.max(0, powerW) * 24) / 1000;
  const elecCostPerDay = kWhPerDay * Math.max(0, electricity);
  const profitNow = netUsdNow - elecCostPerDay;
  const profitAfter = netUsdAfter - elecCostPerDay;
  
  const profitChangePct = (() => {
    if (!Number.isFinite(profitNow) || profitNow === 0) return null;
    return ((profitAfter - profitNow) / Math.abs(profitNow)) * 100;
  })();

  const epochStart = 840_000;
  const epochEnd = nextHalvingHeight;
  const epochPct = useMemo(() => {
    if (tipHeight == null) return 0;
    if (tipHeight <= epochStart) return 0;
    if (tipHeight >= epochEnd) return 100;
    return ((tipHeight - epochStart) / (epochEnd - epochStart)) * 100;
  }, [tipHeight, epochEnd]);

  const schedule = [
    { label: "2012", height: 210_000, reward: 25, passed: true },
    { label: "2016", height: 420_000, reward: 12.5, passed: true },
    { label: "2020", height: 630_000, reward: 6.25, passed: true },
    { label: "2024", height: 840_000, reward: 3.125, passed: true },
    { label: "Next", height: 1_050_000, reward: 1.5625, passed: false },
  ];

  return (
    <div className="space-y-8 pb-20">
      
      {/* 1. COUNTDOWN HERO */}
      <section className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-zinc-900/0 to-zinc-950/0 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] pointer-events-none rounded-full translate-x-1/3 -translate-y-1/2" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
          
          {/* Timer */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-400 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Mission Clock
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter tabular-nums drop-shadow-2xl">
              {t ? (
                <>
                  <span className="text-white">{t.days}</span><span className="text-zinc-600 text-2xl mx-1">d</span>
                  <span className="text-white">{String(t.hrs).padStart(2, "0")}</span><span className="text-zinc-600 text-2xl mx-1">h</span>
                  <span className="text-white">{String(t.mins).padStart(2, "0")}</span><span className="text-zinc-600 text-2xl mx-1">m</span>
                  <span className="text-amber-500">{String(t.secs).padStart(2, "0")}</span><span className="text-amber-500/50 text-2xl mx-1">s</span>
                </>
              ) : (
                <span className="text-zinc-600 animate-pulse">SYNCING...</span>
              )}
            </h1>
            
            <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-4 text-xs font-mono text-zinc-400">
              <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/5">
                Block Height: <span className="text-white font-bold">{formatInt(tipHeight)}</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/5">
                Target: <span className="text-amber-400 font-bold">{formatInt(nextHalvingHeight)}</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/5">
                Blocks Left: <span className="text-white font-bold">{blocksRemaining == null ? "—" : formatInt(blocksRemaining)}</span>
              </div>
            </div>
          </div>

          {/* Progress Circle */}
          <div className="shrink-0 relative group">
            <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity" />
            <ProgressRing pct={epochPct} />
          </div>
        </div>
      </section>

      {/* 2. REWARD SCHEDULE */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <GlowStat label="Current Reward" value={`${currentReward} BTC`} sub="Per Block" tone="default" />
        <GlowStat label="Next Reward" value={`${nextReward} BTC`} sub="Post-Halving" tone="orange" />
        <GlowStat label="Daily Issuance" value={`${formatInt(Math.round(dailyBtcIssuedNow))} BTC`} sub="Global Supply" tone="default" />
        <GlowStat label="Next Issuance" value={`${formatInt(Math.round(dailyBtcIssuedAfter))} BTC`} sub="~50% Drop" tone="cyan" />
      </section>

      {/* 3. IMPACT SIMULATOR */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Controls */}
        <div className="lg:col-span-4 rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 text-lg">🧮</span>
            <div>
              <h3 className="text-lg font-bold text-white">Impact Simulator</h3>
              <p className="text-xs text-zinc-500">Estimate your post-halving profitability.</p>
            </div>
          </div>

          <div className="space-y-3">
            <InputField label="BTC Price (USD)" value={btcPrice} setValue={setBtcPrice} min={0} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Hashrate (TH/s)" value={hashrateTh} setValue={setHashrateTh} min={0} />
              <InputField label="Power (W)" value={powerW} setValue={setPowerW} min={0} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Elec. Cost ($/kWh)" value={electricity} setValue={setElectricity} step="0.01" min={0} />
              <InputField label="Pool Fee (%)" value={poolFeePct} setValue={setPoolFeePct} min={0} max={100} />
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-200/70 leading-relaxed">
            <strong>Disclaimer:</strong> This is a simplified educational model assuming a static network hashrate of {formatInt(assumedNetworkTh / 1_000_000)} EH/s. Real-world difficulty adjustments will vary.
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-8 grid gap-4 sm:grid-cols-2">
          {/* NOW Card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-zinc-900/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Current Era</span>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-mono text-zinc-400">Pre-Halving</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase text-zinc-500">Gross Revenue</div>
                <div className="text-2xl font-black text-white">${formatFloat(grossUsdNow, 2)}<span className="text-sm font-medium text-zinc-600">/day</span></div>
              </div>
              
              <div className="h-px bg-white/5" />
              
              <div>
                <div className="text-[10px] uppercase text-zinc-500">Net Profit</div>
                <div className={`text-3xl font-black ${profitNow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  ${formatFloat(profitNow, 2)}
                </div>
                <div className="text-xs text-zinc-600 mt-1">After elec. costs</div>
              </div>
            </div>
          </div>

          {/* AFTER Card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-zinc-900/40 p-6">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>

            <div className="mb-4 flex items-center justify-between relative z-10">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Next Era</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-mono text-amber-300 border border-amber-500/20">Post-Halving</span>
            </div>
            
            <div className="space-y-4 relative z-10">
              <div>
                <div className="text-[10px] uppercase text-amber-500/60">Gross Revenue</div>
                <div className="text-2xl font-black text-white">${formatFloat(grossUsdAfter, 2)}<span className="text-sm font-medium text-zinc-600">/day</span></div>
              </div>
              
              <div className="h-px bg-amber-500/10" />
              
              <div>
                <div className="text-[10px] uppercase text-amber-500/60">Net Profit</div>
                <div className={`text-3xl font-black ${profitAfter >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  ${formatFloat(profitAfter, 2)}
                </div>
                <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                  <span>Impact:</span>
                  <span className={`font-mono font-bold ${profitChangePct && profitChangePct < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {profitChangePct != null ? `${formatFloat(profitChangePct, 1)}%` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HISTORY LOG */}
      <section className="rounded-[2.5rem] border border-white/5 bg-black/20 p-8">
        <h3 className="text-lg font-bold text-white mb-6">Historical Halving Events</h3>
        <div className="space-y-2">
          {schedule.map((row, i) => (
            <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${row.passed ? "bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100" : "bg-amber-500/5 border-amber-500/20"}`}>
              <div className="flex items-center gap-4">
                <div className={`h-2 w-2 rounded-full ${row.passed ? "bg-zinc-600" : "bg-amber-500 shadow-[0_0_8px_orange] animate-pulse"}`} />
                <div>
                  <div className="font-bold text-white text-sm">{row.label}</div>
                  <div className="text-[10px] font-mono text-zinc-500">Block {formatInt(row.height)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-white text-sm">{row.reward} BTC</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Reward</div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}