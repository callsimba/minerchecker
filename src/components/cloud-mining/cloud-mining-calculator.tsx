"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtPct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

/** * Reusable Input Component with "Focus Glow" 
 */
function InputCard({
  label,
  value,
  setValue,
  unit,
  tone = "default",
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  unit?: string;
  tone?: "purple" | "cyan" | "default";
}) {
  return (
    <div className="group relative rounded-xl bg-zinc-900/40 p-3 ring-1 ring-white/10 transition-all hover:bg-zinc-900/60 focus-within:ring-white/20">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-focus-within:text-zinc-300 transition-colors">
          {label}
        </label>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className={cn(
          "text-lg",
          tone === "purple" ? "text-purple-400" : tone === "cyan" ? "text-cyan-400" : "text-zinc-400"
        )}>
           {tone === "purple" ? "⚡" : tone === "cyan" ? "⚙️" : "›"}
        </span>
        <input
          value={String(value)}
          onChange={(e) => setValue(Number(e.target.value))}
          inputMode="decimal"
          className="w-full bg-transparent text-lg font-medium text-white outline-none placeholder-zinc-700"
        />
        {unit && <span className="text-xs font-medium text-zinc-600">{unit}</span>}
      </div>
    </div>
  );
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl px-4 py-3 shadow-2xl">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Day {label}</div>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span style={{ color: p.color }}>{p.name}:</span>
            <span className="font-mono font-medium text-white">{fmtMoney(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CloudMiningCalculator() {
  // --- Cloud contract inputs ---
  const [contractUpfront, setContractUpfront] = useState(1200);
  const [contractDays, setContractDays] = useState(365);
  const [hashrateTh, setHashrateTh] = useState(100); // TH/s
  const [maintenancePerDay, setMaintenancePerDay] = useState(2.5); // USD/day
  const [downtimePct, setDowntimePct] = useState(2); // % of time lost
  const [difficultyGrowthMonthly, setDifficultyGrowthMonthly] = useState(4); // %/month
  const [revenuePerThPerDay, setRevenuePerThPerDay] = useState(0.08); // USD per TH per day (baseline)

  // --- Owning hardware inputs ---
  const [hardwarePrice, setHardwarePrice] = useState(2500);
  const [powerW, setPowerW] = useState(3200);
  const [electricityRate, setElectricityRate] = useState(0.12); // $/kWh
  const [resalePct, setResalePct] = useState(25); // % of hardware price recouped at end

  // --- Scenario ---
  const [priceScenario, setPriceScenario] = useState<"-20" | "0" | "+20">("0");

  const scenarioMultiplier = useMemo(() => {
    if (priceScenario === "-20") return 0.8;
    if (priceScenario === "+20") return 1.2;
    return 1.0;
  }, [priceScenario]);

  const model = useMemo(() => {
    const days = clamp(Math.floor(contractDays || 0), 1, 3650);
    const th = Math.max(0, Number(hashrateTh || 0));
    const baseline = Math.max(0, Number(revenuePerThPerDay || 0)) * scenarioMultiplier;
    const maint = Math.max(0, Number(maintenancePerDay || 0));
    const up = Math.max(0, Number(contractUpfront || 0));
    const down = clamp(Number(downtimePct || 0), 0, 40) / 100;

    const monthlyGrowth = clamp(Number(difficultyGrowthMonthly || 0), 0, 30) / 100;
    const dailyDecay = Math.pow(1 + monthlyGrowth, 1 / 30) - 1; 

    // Own hardware costs
    const hw = Math.max(0, Number(hardwarePrice || 0));
    const w = Math.max(0, Number(powerW || 0));
    const kwhPerDay = (w * 24) / 1000;
    const elec = Math.max(0, Number(electricityRate || 0));
    const elecPerDay = kwhPerDay * elec;
    const resale = clamp(Number(resalePct || 0), 0, 80) / 100;

    let cumCloud = -up;
    let cumOwn = -hw;

    const points: Array<{
      day: number;
      cloudDaily: number;
      ownDaily: number;
      cloudCum: number;
      ownCum: number;
    }> = [];

    for (let d = 1; d <= days; d++) {
      const decayFactor = Math.pow(1 - dailyDecay, d - 1);
      const grossPerDay = th * baseline * decayFactor;
      const grossAfterDown = grossPerDay * (1 - down);

      const cloudNet = grossAfterDown - maint;
      const ownNet = grossAfterDown - elecPerDay;

      cumCloud += cloudNet;
      cumOwn += ownNet;

      points.push({
        day: d,
        cloudDaily: cloudNet,
        ownDaily: ownNet,
        cloudCum: cumCloud,
        ownCum: cumOwn,
      });
    }

    const ownFinal = cumOwn + hw * resale;
    const cloudFinal = cumCloud;

    const cloudRoi = up > 0 ? (cloudFinal / up) * 100 : 0;
    const ownRoi = hw > 0 ? (ownFinal / hw) * 100 : 0;

    const breakEvenCloud = points.find((p) => p.cloudCum >= 0)?.day ?? null;
    const breakEvenOwn = points.find((p) => p.ownCum >= 0)?.day ?? null;

    return {
      points,
      days,
      cloudFinal,
      ownFinal,
      cloudRoi,
      ownRoi,
      elecPerDay,
      breakEvenCloud,
      breakEvenOwn,
    };
  }, [contractDays, hashrateTh, revenuePerThPerDay, scenarioMultiplier, maintenancePerDay, contractUpfront, downtimePct, difficultyGrowthMonthly, hardwarePrice, powerW, electricityRate, resalePct]);

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
      {/* HEADER BAR */}
      <div className="border-b border-white/5 bg-white/[0.02] p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Profitability Simulator</h2>
            <p className="text-sm text-zinc-500">Stress-test contracts against difficulty & downtime.</p>
          </div>

          <div className="flex items-center rounded-xl bg-zinc-900/50 p-1 ring-1 ring-white/10">
            {[
              { id: "-20", label: "Bear (-20%)", color: "text-red-400" },
              { id: "0", label: "Base Case", color: "text-white" },
              { id: "+20", label: "Bull (+20%)", color: "text-emerald-400" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setPriceScenario(s.id as any)}
                className={cn(
                  "rounded-lg px-4 py-2 text-xs font-medium transition-all",
                  priceScenario === s.id
                    ? "bg-white/10 shadow-sm text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12">
        {/* LEFT: INPUTS */}
        <div className="lg:col-span-4 border-r border-white/5 bg-zinc-900/20 p-6">
          <div className="space-y-8">
            
            {/* Cloud Section */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/10 text-[10px] text-purple-400 ring-1 ring-purple-500/30">1</span>
                <h3 className="text-sm font-semibold text-purple-200">Cloud Contract</h3>
              </div>
              <div className="space-y-3">
                <InputCard label="Upfront Cost" value={contractUpfront} setValue={setContractUpfront} unit="USD" tone="purple" />
                <InputCard label="Duration" value={contractDays} setValue={setContractDays} unit="Days" tone="purple" />
                <InputCard label="Hashrate" value={hashrateTh} setValue={setHashrateTh} unit="TH/s" tone="purple" />
                <InputCard label="Maint. Fee" value={maintenancePerDay} setValue={setMaintenancePerDay} unit="$/Day" tone="purple" />
                <div className="grid grid-cols-2 gap-3">
                  <InputCard label="Downtime" value={downtimePct} setValue={setDowntimePct} unit="%" tone="purple" />
                  <InputCard label="Diff Growth" value={difficultyGrowthMonthly} setValue={setDifficultyGrowthMonthly} unit="%/mo" tone="purple" />
                </div>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Hardware Section */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/10 text-[10px] text-cyan-400 ring-1 ring-cyan-500/30">2</span>
                <h3 className="text-sm font-semibold text-cyan-200">Own Hardware</h3>
              </div>
              <div className="space-y-3">
                <InputCard label="Hardware Cost" value={hardwarePrice} setValue={setHardwarePrice} unit="USD" tone="cyan" />
                <InputCard label="Power Draw" value={powerW} setValue={setPowerW} unit="Watts" tone="cyan" />
                <InputCard label="Elec. Rate" value={electricityRate} setValue={setElectricityRate} unit="$/kWh" tone="cyan" />
                <InputCard label="Resale Value" value={resalePct} setValue={setResalePct} unit="%" tone="cyan" />
              </div>
            </div>

            {/* Global Var */}
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
               <label className="text-[10px] font-bold uppercase tracking-wider text-yellow-500/80">Global Assumption</label>
               <div className="mt-2 flex items-center justify-between">
                 <span className="text-xs text-zinc-400">Rev / TH / Day</span>
                 <input 
                    value={revenuePerThPerDay}
                    onChange={(e) => setRevenuePerThPerDay(Number(e.target.value))}
                    className="w-20 rounded bg-black/20 px-2 py-1 text-right text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-yellow-500/50"
                 />
               </div>
            </div>

          </div>
        </div>

        {/* RIGHT: VISUALIZATION */}
        <div className="lg:col-span-8 bg-zinc-950 p-6 md:p-8">
          
          {/* Top Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
             <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-400">Cloud Net Result</div>
                <div className="mt-2 text-3xl font-bold text-white">{fmtMoney(model.cloudFinal)}</div>
                <div className="mt-1 flex items-center gap-3 text-xs">
                   <span className="text-purple-200/60">ROI: <span className="text-white">{fmtPct(model.cloudRoi)}</span></span>
                   <span className="text-purple-200/60">BE: <span className="text-white">{model.breakEvenCloud ? `Day ${model.breakEvenCloud}` : "Never"}</span></span>
                </div>
             </div>

             <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">Hardware Net Result</div>
                <div className="mt-2 text-3xl font-bold text-white">{fmtMoney(model.ownFinal)}</div>
                <div className="mt-1 flex items-center gap-3 text-xs">
                   <span className="text-cyan-200/60">ROI: <span className="text-white">{fmtPct(model.ownRoi)}</span></span>
                   <span className="text-cyan-200/60">BE: <span className="text-white">{model.breakEvenOwn ? `Day ${model.breakEvenOwn}` : "Never"}</span></span>
                </div>
             </div>
          </div>

          {/* Main Chart */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
               <h4 className="text-sm font-semibold text-zinc-300">Cumulative Profit (USD)</h4>
               <div className="flex items-center gap-4 text-xs">
                 <div className="flex items-center gap-2">
                   <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                   <span className="text-zinc-500">Cloud</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="h-2 w-2 rounded-full bg-cyan-500"></span>
                   <span className="text-zinc-500">Hardware</span>
                 </div>
               </div>
            </div>
            <div className="h-[300px] w-full rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={model.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<TooltipBox />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
                  <Line
                    type="monotone"
                    dataKey="cloudCum"
                    name="Cloud"
                    stroke="#a855f7"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ownCum"
                    name="Hardware"
                    stroke="#06b6d4"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Chart */}
          <div className="mt-8">
             <h4 className="mb-4 text-sm font-semibold text-zinc-300">Daily Net Revenue (Declining Yield)</h4>
             <div className="h-[200px] w-full rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={model.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" hide />
                  <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<TooltipBox />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
                  <Area
                    type="monotone"
                    dataKey="cloudDaily"
                    name="Cloud Net"
                    stroke="#a855f7"
                    fill="url(#colorCloud)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="ownDaily"
                    name="Hardware Net"
                    stroke="#06b6d4"
                    fill="url(#colorOwn)"
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient id="colorCloud" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOwn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
               <span>⚠️</span>
               <span>Operational costs (Electricty / Maint) are constant, but revenue drops due to difficulty. This creates the "Death Cross" where mining becomes unprofitable.</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}