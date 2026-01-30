"use client";

import { useEffect, useMemo, useState } from "react";

const formatUsd = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);

function generateAreaChartPath(values: number[], width = 600, height = 180) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const padding = 10;

  const stepX = (width - padding * 2) / (valid.length - 1);

  const points = valid.map((val, i) => {
    const x = padding + i * stepX;
    const normalizedVal = (val - min) / range;
    const y = height - padding - normalizedVal * (height - padding * 2);
    return [x, y] as const;
  });

  const linePath = "M" + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const fillPath = linePath + ` L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;

  return { linePath, fillPath, isProfit: valid[valid.length - 1] >= 0 };
}

type BestCoinLite = {
  symbol?: string | null;
  name?: string | null;
};

type WidgetProps = {
  history: number[];

  // Snapshot baseline numbers (USD/day)
  baseRevenue: number | null;
  baseElec: number; // snapshot electricity at snapshot baseline elec rate (kept for backward compat; not required)
  electricityRate: number; // selected rate (used for simulation electricity)
  powerW: number;

  bestPrice: number | null;
  bestVendor: string | null;
  bestUrl: string | null;
  regionKey: string;

  updatedAt: Date;

  // ✅ NEW: from DB snapshot
  bestCoin?: BestCoinLite | null;
  bestCoinConfidence?: number | null; // 0..100
  bestCoinReason?: string | null;
  breakdown?: any | null; // stored JSON breakdown from costs.ts (optional; used for display consistency)
};

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function confidenceLabel(score: number | null | undefined) {
  const n = score == null ? null : safeNum(score);
  if (n == null) return { label: "—", cls: "text-slate-400 bg-slate-800/60 border-slate-700" };
  if (n >= 80) return { label: "High", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
  if (n >= 55) return { label: "Medium", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
  return { label: "Low", cls: "text-red-300 bg-red-500/10 border-red-500/30" };
}

function parseBreakdown(breakdown: any | null | undefined) {
  const b: any = breakdown ?? null;

  // costs.ts structure (preferred)
  const revenueUsdPerDay = safeNum(b?.inputs?.revenueUsdPerDay);
  const electricityUsdPerDay = safeNum(b?.daily?.electricityUsdPerDay);
  const poolFeeUsdPerDay = safeNum(b?.daily?.poolFeeUsdPerDay);
  const hostingUsdPerDay = safeNum(b?.daily?.hostingUsdPerDay);
  const netProfitUsdPerDay = safeNum(b?.totals?.netProfitUsdPerDay);

  const roiDays =
    typeof b?.totals?.roiDays === "number"
      ? b.totals.roiDays
      : safeNum(b?.totals?.roiDays);

  const paybackDate = typeof b?.paybackDate === "string" ? b.paybackDate : null;

  // Inputs that make breakdown explainable
  const poolFeePct = safeNum(b?.inputs?.poolFeePct);
  const electricityUsdPerKwh = safeNum(b?.inputs?.electricityUsdPerKwh);
  const powerW = safeNum(b?.inputs?.powerW);

  return {
    revenueUsdPerDay,
    electricityUsdPerDay,
    poolFeeUsdPerDay,
    hostingUsdPerDay,
    netProfitUsdPerDay,
    roiDays: roiDays == null ? null : Math.ceil(roiDays),
    paybackDate,
    poolFeePct,
    electricityUsdPerKwh,
    powerW,
  };
}

export function ProfitabilityWidget({
  history,
  baseRevenue,
  electricityRate,
  powerW,
  bestPrice,
  bestVendor,
  bestUrl,
  regionKey,
  updatedAt,

  // ✅ from DB snapshot
  bestCoin,
  bestCoinConfidence,
  bestCoinReason,
  breakdown,
}: WidgetProps) {
  // --- Simulation State ---
  const [mode, setMode] = useState<"home" | "hosting">("home");
  const [quantity, setQuantity] = useState(1);
  const [hostingFee, setHostingFee] = useState(0); // $ per month per unit
  const [poolFee, setPoolFee] = useState(2); // %
  const [uptime, setUptime] = useState(98); // %

  // --- Inputs ---
  const [hardwareCost, setHardwareCost] = useState(bestPrice ?? 0);
  useEffect(() => {
    if (bestPrice != null) setHardwareCost(bestPrice);
  }, [bestPrice]);

  // --- Calculations ---
  const poolFeePctClamped = clamp(poolFee, 0, 100);
  const uptimeClamped = clamp(uptime, 0, 100);

  // 1) Adjusted Revenue (Uptime + Pool Fee)
  const effectiveRevenuePerUnit =
    (baseRevenue ?? 0) * (uptimeClamped / 100) * (1 - poolFeePctClamped / 100);

  // 2) Adjusted Costs
  const kwhPerDay = (powerW * 24) / 1000;
  const elecCostPerUnit = kwhPerDay * electricityRate;
  const dailyHostingCostPerUnit = mode === "hosting" ? hostingFee / 30.4 : 0;

  // 3) Totals
  const totalRevenue = effectiveRevenuePerUnit * quantity;
  const totalCost = (elecCostPerUnit + dailyHostingCostPerUnit) * quantity;
  const dailyProfit = totalRevenue - totalCost;

  // 4) ROI + Payback
  const totalInvestment = (hardwareCost || 0) * quantity;
  const roiDays = dailyProfit > 0 ? totalInvestment / dailyProfit : Infinity;
  const breakEvenDate =
    dailyProfit > 0 ? new Date(Date.now() + roiDays * 24 * 60 * 60 * 1000) : null;

  // 5) Sensitivity (+$0.02/kWh)
  const sensRate = electricityRate + 0.02;
  const sensCost = (kwhPerDay * sensRate + dailyHostingCostPerUnit) * quantity;
  const sensProfit = totalRevenue - sensCost;

  // --- Confidence (✅ from DB, no more "invented by time") ---
  const conf = confidenceLabel(bestCoinConfidence);

  // We still show "Updated Xh ago" because it's useful, but it's not used to compute confidence.
  const dataAgeHours =
    (new Date().getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60);

  // --- Risk Indicators ---
  const isVolatile =
    history.length > 10 &&
    (Math.max(...history) - Math.min(...history)) / (Math.abs(history[0]) || 1) > 0.5;
  const riskLevel = dailyProfit < 0 ? "Critical" : isVolatile ? "Medium" : "Low";

  // --- Chart Data ---
  const chartData = useMemo(() => {
    if (!history.length) return null;
    const scaled = history.slice(-90).map((v) => v * quantity);
    return generateAreaChartPath(scaled);
  }, [history, quantity]);

  // --- Snapshot Breakdown (read-only) ---
  const snap = useMemo(() => parseBreakdown(breakdown), [breakdown]);

  return (
    <div className="bg-[#151a2a] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col gap-6">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                dailyProfit > 0
                  ? "bg-emerald-500 shadow-[0_0_10px_#10b981]"
                  : "bg-red-500 shadow-[0_0_10px_#ef4444]"
              }`}
            />
            Profit Simulator
          </h2>

          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span className="text-slate-500">Conf:</span>
              <span className={`px-2 py-0.5 rounded-md border font-bold ${conf.cls}`}>
                {conf.label}
              </span>
              {typeof bestCoinConfidence === "number" ? (
                <span className="text-slate-500">({Math.round(bestCoinConfidence)}/100)</span>
              ) : null}
            </span>
            <span className="text-slate-600">•</span>
            <span>Updated: {Number.isFinite(dataAgeHours) ? dataAgeHours.toFixed(1) : "—"}h ago</span>
          </div>

          {/* Best coin + reason */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-md border border-slate-800 bg-slate-900/40 text-slate-300 font-bold">
              🪙 Best coin:{" "}
              <span className="text-white">
                {bestCoin?.symbol ? bestCoin.symbol : "—"}
              </span>
              {bestCoin?.name ? (
                <span className="text-slate-400 font-medium"> • {bestCoin.name}</span>
              ) : null}
            </span>
            {bestCoinReason ? (
              <span className="text-slate-400 truncate max-w-[520px]">
                {bestCoinReason}
              </span>
            ) : (
              <span className="text-slate-600">No reason provided</span>
            )}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex shrink-0">
          <button
            onClick={() => setMode("home")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              mode === "home"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            🏠 Home
          </button>
          <button
            onClick={() => setMode("hosting")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              mode === "hosting"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            🏢 Hosting
          </button>
        </div>
      </div>

      {/* Simulator Controls */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500">Qty</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-full bg-transparent text-white font-mono font-bold outline-none border-b border-slate-700 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500">Uptime %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={uptime}
            onChange={(e) => setUptime(clamp(Number(e.target.value), 0, 100))}
            className="w-full bg-transparent text-white font-mono font-bold outline-none border-b border-slate-700 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500">Pool Fee %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={poolFee}
            onChange={(e) => setPoolFee(clamp(Number(e.target.value), 0, 100))}
            className="w-full bg-transparent text-white font-mono font-bold outline-none border-b border-slate-700 focus:border-orange-500"
          />
        </div>

        {mode === "hosting" && (
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500">Host ($/mo)</label>
            <input
              type="number"
              min="0"
              value={hostingFee}
              onChange={(e) => setHostingFee(Math.max(0, Number(e.target.value)))}
              className="w-full bg-transparent text-white font-mono font-bold outline-none border-b border-slate-700 focus:border-orange-500"
            />
          </div>
        )}

        <div className={`${mode === "hosting" ? "" : "md:col-start-5"}`}>
          <label className="text-[10px] uppercase font-bold text-slate-500">Hardware ($)</label>
          <input
            type="number"
            min="0"
            value={hardwareCost}
            onChange={(e) => setHardwareCost(Math.max(0, Number(e.target.value)))}
            className="w-full bg-transparent text-white font-mono font-bold outline-none border-b border-slate-700 focus:border-orange-500"
          />
        </div>
      </div>

      {/* Best price box */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-slate-400">
          Electricity: <span className="text-white font-mono">${electricityRate.toFixed(3)}</span> / kWh •
          Region: <span className="text-white font-mono">{regionKey}</span>
        </div>

        {bestPrice != null ? (
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-1">Best Price (per unit)</div>
            <div className="text-2xl font-bold text-white">${bestPrice.toFixed(2)}</div>
            {bestUrl ? (
              <a
                href={bestUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-orange-400 hover:underline uppercase tracking-wider font-bold"
              >
                Buy from {bestVendor ?? "Vendor"} →
              </a>
            ) : (
              <span className="text-[10px] text-slate-500 font-bold uppercase">
                {bestVendor ?? "—"}
              </span>
            )}
          </div>
        ) : (
          <div className="px-3 py-1 bg-slate-800 rounded-lg text-xs text-slate-400">
            No offers
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="relative z-10 grid grid-cols-3 gap-4">
        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Profit / Day</div>
          <div className={`text-lg font-bold ${dailyProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatUsd(dailyProfit)}
          </div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">ROI</div>
          <div className="text-lg font-bold text-white">
            {roiDays === Infinity ? "Never" : roiDays > 1000 ? "> 3yr" : `${Math.ceil(roiDays)} Days`}
          </div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Risk Level</div>
          <div
            className={`text-lg font-bold ${
              riskLevel === "Low" ? "text-emerald-400" : riskLevel === "Medium" ? "text-amber-400" : "text-red-500"
            }`}
          >
            {riskLevel}
          </div>
          <div
            className={`absolute -right-2 -bottom-4 text-4xl opacity-10 ${
              riskLevel === "Low" ? "text-emerald-500" : "text-red-500"
            }`}
          >
            ⚠️
          </div>
        </div>
      </div>

      {/* Break-even Insight */}
      {dailyProfit > 0 && breakEvenDate && (
        <div className="relative z-10 text-xs text-center text-slate-400 bg-emerald-900/10 py-2 rounded-lg border border-emerald-500/20">
          🎉 Break-even estimated by{" "}
          <span className="text-emerald-300 font-bold">{formatDate(breakEvenDate)}</span>
        </div>
      )}

      {/* Snapshot breakdown teaser (read-only) */}
      {breakdown ? (
        <div className="relative z-10 bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
              Snapshot breakdown
            </div>
            <div className="text-[10px] text-slate-500">
              Stored in DB • revenue/fees/costs
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            <MiniStat label="Revenue/day" value={snap.revenueUsdPerDay == null ? "—" : formatUsd(snap.revenueUsdPerDay)} />
            <MiniStat
              label="Pool/day"
              value={
                snap.poolFeeUsdPerDay == null
                  ? "—"
                  : `${formatUsd(snap.poolFeeUsdPerDay)}${snap.poolFeePct != null ? ` (${snap.poolFeePct.toFixed(2)}%)` : ""}`
              }
            />
            <MiniStat
              label="Electricity/day"
              value={
                snap.electricityUsdPerDay == null
                  ? "—"
                  : `${formatUsd(snap.electricityUsdPerDay)}${
                      snap.electricityUsdPerKwh != null && snap.powerW != null
                        ? ` (${snap.powerW}W @ $${snap.electricityUsdPerKwh.toFixed(3)}/kWh)`
                        : ""
                    }`
              }
            />
            <MiniStat label="Hosting/day" value={snap.hostingUsdPerDay == null ? "—" : formatUsd(snap.hostingUsdPerDay)} />
            <MiniStat
              label="Net/day"
              value={
                snap.netProfitUsdPerDay == null
                  ? "—"
                  : `${formatUsd(snap.netProfitUsdPerDay)}`
              }
              valueClass={
                (snap.netProfitUsdPerDay ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"
              }
            />
            <MiniStat
              label="ROI + Payback"
              value={
                snap.roiDays == null
                  ? "—"
                  : `${snap.roiDays} days${snap.paybackDate ? ` • ${snap.paybackDate}` : ""}`
              }
            />
          </div>

          {bestCoinReason ? (
            <div className="mt-3 text-xs text-slate-400">
              <span className="text-slate-500 font-bold uppercase text-[10px] mr-2">Why</span>
              {bestCoinReason}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Sensitivity Analysis (Mini) */}
      <div className="relative z-10 text-[10px] text-slate-500 flex justify-between items-center border-t border-slate-800 pt-3 mt-1">
        <span>Sensitivity (+${0.02}/kWh):</span>
        <span className={`font-mono font-bold ${sensProfit > 0 ? "text-emerald-500" : "text-red-500"}`}>
          {formatUsd(sensProfit)} / day
        </span>
      </div>

      {/* Chart */}
      <div className="h-[120px] w-full mt-2 relative z-0 opacity-50 hover:opacity-100 transition-opacity">
        {chartData ? (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 600 180"
            preserveAspectRatio="none"
            className="overflow-visible"
          >
            <path d={chartData.fillPath} fill={chartData.isProfit ? "#10b981" : "#ef4444"} fillOpacity="0.1" />
            <path
              d={chartData.linePath}
              fill="none"
              stroke={chartData.isProfit ? "#10b981" : "#ef4444"}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div className="text-center text-xs text-slate-600 pt-10">No History</div>
        )}
      </div>
    </div>
  );
}

function MiniStat(props: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
        {props.label}
      </div>
      <div className={`text-sm font-mono font-bold ${props.valueClass ?? "text-white"}`}>
        {props.value}
      </div>
    </div>
  );
}
