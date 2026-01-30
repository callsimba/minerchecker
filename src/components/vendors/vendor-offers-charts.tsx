"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ScatterChart,
  Scatter,
  CartesianGrid,
  Cell,
} from "recharts";

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(0);
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur-md px-4 py-3 text-xs shadow-2xl">
      <div className="font-bold text-white mb-1">{label ?? "Data Point"}</div>
      {payload.map((x: any) => (
        <div key={x.dataKey} className="flex justify-between gap-4 text-zinc-400">
          <span>{x.name}:</span>
          <span className="text-white font-mono font-bold">{fmt(Number(x.value))}</span>
        </div>
      ))}
      {p?.payload?.hint && (
        <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-zinc-500">
          {p.payload.hint}
        </div>
      )}
    </div>
  );
}

type OfferChartRow = {
  id: string;
  regionKey: string;
  currency: string;
  priceDisplay: number | null;
  priceDisplayText: string;
  displayCurrency: string;
  profitUsdPerDay: number | null;
  roiDays: number | null;
  powerW: number;
  efficiency: number | null;
};

export default function VendorOffersCharts({
  offers,
  displayCurrency,
}: {
  offers: OfferChartRow[];
  displayCurrency: string;
}) {
  const prices = offers
    .map((o) => o.priceDisplay)
    .filter((x): x is number => x != null && Number.isFinite(x));

  const hasPrices = prices.length >= 3;

  // Build histogram buckets
  const histogram = (() => {
    if (!hasPrices) return [];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = Math.max(1, max - min);

    const buckets = 8;
    const step = span / buckets;

    const counts = new Array(buckets).fill(0);

    for (const p of prices) {
      const idx = Math.min(buckets - 1, Math.floor((p - min) / step));
      counts[idx] += 1;
    }

    return counts.map((c, i) => {
      const lo = min + i * step;
      const hi = lo + step;
      return {
        bucket: `${Math.round(lo)}–${Math.round(hi)}`,
        count: c,
        hint: `Offers in ${displayCurrency} price band`,
      };
    });
  })();

  const scatter = offers
    .map((o) => ({
      x: o.priceDisplay,
      y: o.profitUsdPerDay,
      roi: o.roiDays,
      powerW: o.powerW,
      efficiency: o.efficiency,
      hint: o.priceDisplayText,
    }))
    .filter((r) => r.x != null && r.y != null);

  const showScatter = scatter.length >= 4;

  return (
    <section className="grid gap-6 lg:grid-cols-12 mb-12">
      {/* Histogram Card */}
      <div className="lg:col-span-7 relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Price Distribution</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Frequency of offers by price range. Tighter clusters indicate consistent pricing.
            </p>
          </div>
          <div className="rounded-lg bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wider border border-cyan-500/20">
            Histogram
          </div>
        </div>

        <div className="h-[280px] w-full">
          {hasPrices ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="bucket" 
                  tick={{ fontSize: 10, fill: "#71717a" }} 
                  axisLine={false} 
                  tickLine={false} 
                  interval={1}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: "#71717a" }} 
                  axisLine={false} 
                  tickLine={false}
                />
                <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogram.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#06b6d4" fillOpacity={0.6 + (index * 0.05)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-xs text-zinc-500">
              Not enough price data to chart.
            </div>
          )}
        </div>
      </div>

      {/* Scatter Card */}
      <div className="lg:col-span-5 relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Value Matrix</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Price vs. Daily Profit. Look for points in the <span className="text-emerald-400">top-left</span> (Cheap & High Profit).
            </p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider border border-emerald-500/20">
            Scatter
          </div>
        </div>

        <div className="h-[280px] w-full">
          {showScatter ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Price"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Price →", position: "insideBottom", offset: -5, fill: "#52525b", fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Profit"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Profit/Day ↑", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 10 }}
                />
                <Tooltip content={<TooltipBox />} cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }} />
                <Scatter name="Offers" data={scatter} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-xs text-zinc-500">
              Not enough profitability data to chart.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}