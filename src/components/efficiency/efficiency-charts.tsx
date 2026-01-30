// src/components/efficiency/efficiency-charts.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  ZAxis,
  Cell,
} from "recharts";

type HistogramBin = {
  from: number;
  to: number;
  label: string;
  count: number;
};

type Point = {
  id: string;
  name: string;
  slug: string;
  algorithmKey: string | null;
  algorithmName: string;
  efficiencyJTH: number;
  powerW: number | null;
  ths: number | null;
};

type Stats = {
  total: number;
  min: number | null;
  median: number | null;
  p90: number | null;
};

function CustomTooltip({ active, payload, label, mode }: any) {
  if (!active || !payload || !payload.length) return null;
  
  // Scatter tooltip
  if (payload[0].payload.slug) {
    const d = payload[0].payload;
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-950/90 p-3 shadow-xl backdrop-blur-md">
        <div className="font-bold text-white text-sm mb-1">{d.name}</div>
        <div className="text-[10px] text-zinc-400 mb-2 uppercase tracking-wider">{d.algorithmName}</div>
        <div className="space-y-1 font-mono text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Efficiency</span>
            <span className="text-cyan-400">{d.x.toFixed(1)} J/TH</span>
          </div>
          <div className="flex justify-between gap-4">
             <span className="text-zinc-500">{mode === "power" ? "Power" : "Hashrate"}</span>
             <span className="text-white">
               {mode === "power" ? `${Math.round(d.y)} W` : `${d.y.toFixed(1)} TH/s`}
             </span>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-cyan-500 font-medium">Click to view details →</div>
      </div>
    );
  }

  // Bar tooltip
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/90 p-2 shadow-xl backdrop-blur-md text-xs">
      <div className="font-mono text-zinc-300 mb-1">{label} J/TH</div>
      <div className="text-white font-bold">{payload[0].value} Miners</div>
    </div>
  );
}

export default function EfficiencyCharts({
  histogram,
  points,
  stats,
}: {
  histogram: HistogramBin[];
  points: Point[];
  stats?: Stats;
}) {
  const [mode, setMode] = useState<"power" | "hashrate">("power");

  const scatterData = useMemo(() => {
    return points
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        algorithmName: p.algorithmName,
        x: Number(p.efficiencyJTH),
        y:
          mode === "power"
            ? p.powerW != null && Number.isFinite(p.powerW)
              ? Number(p.powerW)
              : null
            : p.ths != null && Number.isFinite(p.ths)
            ? Number(p.ths)
            : null,
      }))
      .filter((d) => d.y != null) as Array<{
      name: string;
      slug: string;
      algorithmName: string;
      x: number;
      y: number;
    }>;
  }, [points, mode]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      
      {/* Histogram Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur-md">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Efficiency Distribution</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Frequency of miners by efficiency bucket (Lower J/TH is better).
            </p>
          </div>
          <div className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-mono text-zinc-400 border border-white/5">
            {stats?.total ?? 0} Models
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogram}>
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 10, fill: "#71717a" }} 
                axisLine={false} 
                tickLine={false} 
                interval={2} 
              />
              <YAxis hide />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {histogram.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index < 3 ? "#22d3ee" : "#3f3f46"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scatter Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur-md">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Market Scatter</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Identify outliers: High hashrate + Low J/TH = Best Performers.
            </p>
          </div>

          <div className="flex rounded-lg bg-zinc-950 p-1 ring-1 ring-white/10">
            <button
              onClick={() => setMode("power")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${
                mode === "power" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              vs Power
            </button>
            <button
              onClick={() => setMode("hashrate")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${
                mode === "hashrate" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              vs Hashrate
            </button>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                type="number"
                dataKey="x"
                name="Efficiency"
                unit=" J/TH"
                tick={{ fontSize: 10, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                label={{ value: "Efficiency (J/TH) →", position: "insideBottom", offset: -5, fill: "#52525b", fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={mode === "power" ? "Power" : "Hashrate"}
                unit={mode === "power" ? " W" : " TH/s"}
                tick={{ fontSize: 10, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
              />
              <ZAxis type="number" range={[50, 50]} />
              <Tooltip cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.1)" }} content={<CustomTooltip mode={mode} />} />
              <Scatter name="Miners" data={scatterData} fill={mode === "hashrate" ? "#a855f7" : "#06b6d4"} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}