"use client";

import { useState, useMemo } from "react";
import { formatMoney } from "@/server/public";

function generateAreaChart(values: number[], width = 600, height = 150) {
  const validValues = values.filter((v) => Number.isFinite(v));
  if (validValues.length < 2) return null;

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min || 1;
  const padding = 5;
  const stepX = (width - padding * 2) / (validValues.length - 1);

  const points = validValues.map((val, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });

  const linePath =
    "M" + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");

  const fillPath =
    linePath +
    ` L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;

  return { linePath, fillPath, isProfit: validValues[validValues.length - 1] >= 0 };
}

export function ProfitabilityCalculator({
  history,
  baseRevenueUsd,
  baseElecCostUsd,
  currency,
  fxRates, // Pass fxRates map if needed for precise conversion, or simplified here
  electricityRate,
  regionKey,
  bestOfferPrice,
  bestOfferVendor,
  bestOfferUrl,
}: {
  history: number[];
  baseRevenueUsd: number | null;
  baseElecCostUsd: number;
  currency: string;
  fxRates: any;
  electricityRate: number;
  regionKey: string;
  bestOfferPrice: number | null;
  bestOfferVendor?: string;
  bestOfferUrl?: string | null;
}) {
  const [quantity, setQuantity] = useState(1);

  // --- Calculations based on Quantity ---
  const revenueSafe = (baseRevenueUsd ?? 0) * quantity;
  const elecCostSafe = baseElecCostUsd * quantity;
  const profitSafe = revenueSafe - elecCostSafe;

  // Scale chart history by quantity
  const scaledHistory = useMemo(() => {
    return history.map((val) => val * quantity);
  }, [history, quantity]);

  const chartData = useMemo(() => 
    generateAreaChart(scaledHistory), 
  [scaledHistory]);

  const financials = [
    { label: "Daily", mult: 1 },
    { label: "Monthly", mult: 30.4 },
    { label: "Yearly", mult: 365 },
  ].map((period) => {
    // Simple currency formatter for the client side display
    // Note: In a real app, pass the converter function or pre-converted rates
    const format = (usdVal: number) => 
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usdVal);

    if (baseRevenueUsd == null) {
        return {
            label: period.label,
            income: "—",
            electricity: format(elecCostSafe * period.mult),
            profit: "—",
            isPositive: false
        }
    }

    const pProfit = profitSafe * period.mult;
    return {
      label: period.label,
      income: format(revenueSafe * period.mult),
      electricity: format(elecCostSafe * period.mult),
      profit: format(pProfit),
      isPositive: pProfit >= 0,
    };
  });

  return (
    <div className="bg-[#151a2a] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div className="relative z-10">
        {/* Header Section */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Profitability
            </h2>
            <div className="text-slate-400 text-xs mt-1">
              Electricity: <span className="text-white font-mono">${electricityRate}</span> / kWh • 
              Region: <span className="text-white font-mono">{regionKey}</span>
            </div>
          </div>

          {/* Best Price Box */}
          {bestOfferPrice !== null ? (
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-1">Best Price (per unit)</div>
              <div className="text-2xl font-bold text-white">${bestOfferPrice.toFixed(2)}</div>
              {bestOfferUrl ? (
                <a
                  href={bestOfferUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-orange-400 hover:underline uppercase tracking-wider font-bold"
                >
                  Buy from {bestOfferVendor} →
                </a>
              ) : <span className="text-[10px] text-slate-500 font-bold uppercase">{bestOfferVendor}</span>}
            </div>
          ) : (
            <div className="px-3 py-1 bg-slate-800 rounded-lg text-xs text-slate-400">
              No offers
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="h-[180px] w-full mb-6 relative">
          {chartData ? (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 600 150`}
              preserveAspectRatio="none"
              className="overflow-visible"
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartData.isProfit ? "#10b981" : "#ef4444"} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={chartData.isProfit ? "#10b981" : "#ef4444"} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={chartData.fillPath} fill="url(#chartGradient)" />
              <path d={chartData.linePath} fill="none" stroke={chartData.isProfit ? "#10b981" : "#ef4444"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-600 text-sm">
              Not enough history
            </div>
          )}
        </div>

        {/* Quantity Selector & Table */}
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Quantity</span>
                <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700">
                    <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-l-lg transition-colors"
                    >−</button>
                    <div className="px-2 w-10 text-center font-mono text-sm text-white">{quantity}</div>
                    <button 
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-3 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-r-lg transition-colors"
                    >+</button>
                </div>
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
               Live Calculator
            </div>
        </div>

        {/* Table */}
        <div className="bg-[#0b0e14] rounded-xl border border-slate-800 overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-slate-900/50 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-800">
            <div>Period</div>
            <div className="text-right">Income</div>
            <div className="text-right">Elec</div>
            <div className="text-right">Profit</div>
          </div>

          {financials.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors"
            >
              <div className="text-sm font-medium text-slate-300">{row.label}</div>
              <div className="text-sm font-mono text-right text-emerald-400/80">
                {row.income}
              </div>
              <div className="text-sm font-mono text-right text-red-400/80">
                {row.electricity}
              </div>
              <div
                className={`text-sm font-mono text-right font-bold ${
                  row.isPositive ? "text-emerald-400" : "text-red-500"
                }`}
              >
                {row.profit}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}