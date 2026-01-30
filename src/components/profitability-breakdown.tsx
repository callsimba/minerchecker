"use client";

import Image from "next/image";

type BestCoinLite = {
  symbol?: string | null;
  name?: string | null;
};

type BreakdownJson = any;

function fmtUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseBreakdown(breakdown: BreakdownJson | null | undefined) {
  const b: any = breakdown ?? null;

  // costs.ts structure (preferred)
  const revenue = safeNum(b?.inputs?.revenueUsdPerDay);
  const elec = safeNum(b?.daily?.electricityUsdPerDay);
  const poolFeeUsd = safeNum(b?.daily?.poolFeeUsdPerDay);
  const hostingUsd = safeNum(b?.daily?.hostingUsdPerDay);
  const net = safeNum(b?.totals?.netProfitUsdPerDay);
  const roiDays = safeNum(b?.totals?.roiDays) ?? (b?.totals?.roiDays ?? null);
  const poolFeePct = safeNum(b?.inputs?.poolFeePct);
  const electricityRate = safeNum(b?.inputs?.electricityUsdPerKwh);
  const powerW = safeNum(b?.inputs?.powerW);
  const paybackDate = typeof b?.paybackDate === "string" ? b.paybackDate : null;

  // If you stored other shape later, you can extend here.

  return {
    revenueUsdPerDay: revenue,
    electricityUsdPerDay: elec,
    poolFeeUsdPerDay: poolFeeUsd,
    hostingUsdPerDay: hostingUsd,
    netProfitUsdPerDay: net,
    roiDays: typeof roiDays === "number" ? roiDays : null,
    poolFeePct,
    electricityUsdPerKwh: electricityRate,
    powerW,
    paybackDate,
  };
}

function confidenceLabel(v: number | null | undefined) {
  const n = safeNum(v);
  if (n == null) return { label: "—", cls: "text-slate-400 bg-slate-800/60 border-slate-700" };
  if (n >= 80) return { label: "High", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
  if (n >= 55) return { label: "Medium", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
  return { label: "Low", cls: "text-red-300 bg-red-500/10 border-red-500/30" };
}

export function ProfitabilityBreakdown(props: {
  breakdown: BreakdownJson | null | undefined;

  bestCoin?: BestCoinLite | null;
  bestCoinConfidence?: number | null;
  bestCoinReason?: string | null;

  // Optional extras you can pass (nice-to-have)
  revenueSource?: string | null; // e.g. "NiceHash", "Hashrate.no", "Fallback"
}) {
  const {
    breakdown,
    bestCoin,
    bestCoinConfidence,
    bestCoinReason,
    revenueSource,
  } = props;

  const b = parseBreakdown(breakdown);
  const conf = confidenceLabel(bestCoinConfidence);

  const hasAny =
    b.revenueUsdPerDay != null ||
    b.netProfitUsdPerDay != null ||
    b.electricityUsdPerDay != null;

  return (
    <div className="bg-[#151a2a] border border-slate-800 rounded-3xl p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <span>🧾</span> Profitability Breakdown
          </h3>
          <div className="text-xs text-slate-400 mt-1">
            Snapshot-based (stored in DB) — explainable components, not a simulation.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${conf.cls}`}>
            Confidence: {conf.label}
          </span>
          {revenueSource ? (
            <span className="px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 bg-slate-900/40">
              Source: {revenueSource}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-bold text-slate-400 bg-slate-900/30">
              Source: Snapshot
            </span>
          )}
        </div>
      </div>

      {/* Best coin */}
      <div className="mt-5 bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
            Best coin today
          </div>
          <div className="text-[11px] text-slate-500">
            {bestCoinReason ? "Reason stored" : "—"}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
              {/* If you already have a coin logo helper, you can pass a URL instead.
                  Keeping it neutral so it doesn’t depend on server-only helpers. */}
              <span className="text-lg">🪙</span>
            </div>
            <div>
              <div className="text-white font-bold">
                {bestCoin?.symbol ? bestCoin.symbol : "—"}
                {bestCoin?.name ? (
                  <span className="text-slate-400 font-medium"> • {bestCoin.name}</span>
                ) : null}
              </div>
              {bestCoinReason ? (
                <div className="text-xs text-slate-400 mt-0.5">{bestCoinReason}</div>
              ) : (
                <div className="text-xs text-slate-500 mt-0.5">No reason provided.</div>
              )}
            </div>
          </div>

          {/* confidence number */}
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase font-bold">Score</div>
            <div className="text-white font-bold text-lg">
              {bestCoinConfidence == null ? "—" : Math.round(bestCoinConfidence)}
              {bestCoinConfidence == null ? "" : <span className="text-slate-400 text-sm">/100</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown grid */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Revenue / day</div>
          <div className="mt-1 text-2xl font-bold text-white">{fmtUsd(b.revenueUsdPerDay)}</div>
          <div className="mt-1 text-xs text-slate-500">
            {revenueSource ? `From ${revenueSource}` : "From stored snapshot"}
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Net profit / day</div>
          <div
            className={`mt-1 text-2xl font-bold ${
              (b.netProfitUsdPerDay ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {fmtUsd(b.netProfitUsdPerDay)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Revenue − (Pool + Electricity + Hosting)
          </div>
        </div>
      </div>

      <div className="mt-4 bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-800 bg-slate-900/40">
          <div className="col-span-6">Component</div>
          <div className="col-span-6 text-right">Value</div>
        </div>

        <Row
          label="Pool fee"
          value={
            b.poolFeeUsdPerDay == null
              ? "—"
              : `${fmtUsd(b.poolFeeUsdPerDay)} ${b.poolFeePct != null ? `(${fmtPct(b.poolFeePct)})` : ""}`
          }
          hint={b.poolFeeUsdPerDay == null ? "Not stored yet" : null}
        />

        <Row
          label="Electricity"
          value={
            b.electricityUsdPerDay == null
              ? "—"
              : `${fmtUsd(b.electricityUsdPerDay)} ${
                  b.electricityUsdPerKwh != null && b.powerW != null
                    ? `( ${b.powerW}W @ $${b.electricityUsdPerKwh.toFixed(3)}/kWh )`
                    : ""
                }`
          }
          hint={b.electricityUsdPerDay == null ? "Not stored yet" : null}
        />

        <Row
          label="Hosting"
          value={fmtUsd(b.hostingUsdPerDay)}
          hint={b.hostingUsdPerDay ? null : "Optional"}
        />

        <Row
          label="ROI"
          value={b.roiDays == null ? "—" : `${Math.ceil(b.roiDays)} days`}
          hint={b.roiDays == null ? "Needs capex total + positive net profit" : null}
        />

        <Row
          label="Payback date"
          value={b.paybackDate ?? "—"}
          hint={!b.paybackDate ? "Computed only when ROI exists" : null}
        />
      </div>

      {!hasAny && (
        <div className="mt-4 text-sm text-slate-500 italic">
          No breakdown stored yet for this snapshot.
        </div>
      )}
    </div>
  );
}

function Row(props: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20 transition-colors">
      <div className="col-span-6 text-sm text-slate-300 font-medium">
        {props.label}
        {props.hint ? <span className="ml-2 text-[10px] text-slate-600">({props.hint})</span> : null}
      </div>
      <div className="col-span-6 text-sm font-mono text-right text-white">{props.value}</div>
    </div>
  );
}
