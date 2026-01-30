// src/server/profitability/costs.ts

/**
 * Cost / fee helpers used by the profitability pipeline and UI.
 *
 * Goals:
 * - Keep math deterministic + explainable
 * - Avoid floats where it matters (we still use JS numbers, but round at boundaries)
 * - Provide a single place to compute net profit components
 */

export type CurrencyCode = string;

export type CostInputs = {
  // Power + electricity
  powerW: number;
  electricityUsdPerKwh: number;

  // Revenue baseline (already in USD/day)
  revenueUsdPerDay: number;

  // Fees (optional)
  poolFeePct?: number; // e.g. 2.5 means 2.5%
  hostingUsdPerDay?: number;

  // Capex / one-time costs (optional; used for ROI/Payback date)
  hardwarePriceUsd?: number | null;
  shippingUsd?: number | null;
  vatUsd?: number | null;
  otherOneTimeUsd?: number | null;
};

export type CostBreakdown = {
  // Inputs (normalized)
  inputs: {
    powerW: number;
    electricityUsdPerKwh: number;
    revenueUsdPerDay: number;
    poolFeePct: number;
    hostingUsdPerDay: number;
    hardwarePriceUsd: number | null;
    shippingUsd: number | null;
    vatUsd: number | null;
    otherOneTimeUsd: number | null;
  };

  // Derived daily costs
  daily: {
    electricityUsdPerDay: number;
    poolFeeUsdPerDay: number;
    hostingUsdPerDay: number;
    totalDailyCostUsd: number;
  };

  // Totals
  totals: {
    netProfitUsdPerDay: number;
    grossMarginPct: number | null; // (profit / revenue) * 100
    roiDays: number | null; // based on capexTotalUsd / netProfitUsdPerDay
    capexTotalUsd: number | null; // hardware + shipping + vat + other
  };
};

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function round(n: number, dp = 6) {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

/**
 * Electricity: (W/1000) * 24 * $/kWh
 */
export function computeElectricityUsdPerDay(powerW: number, electricityUsdPerKwh: number) {
  const p = toNum(powerW);
  const e = toNum(electricityUsdPerKwh);

  if (p == null || p <= 0) return 0;
  if (e == null || e < 0) return 0;

  return (p / 1000) * 24 * e;
}

/**
 * Core “advanced” breakdown used by:
 * - snapshot compute (server)
 * - machine page breakdown UI (client/server components)
 */
export function computeCostBreakdown(input: CostInputs): CostBreakdown {
  const powerW = Math.max(0, toNum(input.powerW) ?? 0);
  const electricityUsdPerKwh = Math.max(0, toNum(input.electricityUsdPerKwh) ?? 0);
  const revenueUsdPerDay = Math.max(0, toNum(input.revenueUsdPerDay) ?? 0);

  const poolFeePct = clamp(toNum(input.poolFeePct) ?? 0, 0, 100);
  const hostingUsdPerDay = Math.max(0, toNum(input.hostingUsdPerDay) ?? 0);

  const hardwarePriceUsd =
    input.hardwarePriceUsd == null ? null : Math.max(0, toNum(input.hardwarePriceUsd) ?? 0);
  const shippingUsd =
    input.shippingUsd == null ? null : Math.max(0, toNum(input.shippingUsd) ?? 0);
  const vatUsd = input.vatUsd == null ? null : Math.max(0, toNum(input.vatUsd) ?? 0);
  const otherOneTimeUsd =
    input.otherOneTimeUsd == null ? null : Math.max(0, toNum(input.otherOneTimeUsd) ?? 0);

  const electricityUsdPerDay = computeElectricityUsdPerDay(powerW, electricityUsdPerKwh);
  const poolFeeUsdPerDay = revenueUsdPerDay * (poolFeePct / 100);

  const totalDailyCostUsd = electricityUsdPerDay + poolFeeUsdPerDay + hostingUsdPerDay;
  const netProfitUsdPerDay = revenueUsdPerDay - totalDailyCostUsd;

  // Capex total
  const capexParts = [hardwarePriceUsd, shippingUsd, vatUsd, otherOneTimeUsd].filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x)
  );
  const capexTotalUsd = capexParts.length ? capexParts.reduce((a, b) => a + b, 0) : null;

  // ROI
  let roiDays: number | null = null;
  if (capexTotalUsd != null && capexTotalUsd > 0 && netProfitUsdPerDay > 0) {
    roiDays = Math.ceil(capexTotalUsd / netProfitUsdPerDay);
  }

  // Margin
  const grossMarginPct =
    revenueUsdPerDay > 0 ? (netProfitUsdPerDay / revenueUsdPerDay) * 100 : null;

  return {
    inputs: {
      powerW: round(powerW, 6),
      electricityUsdPerKwh: round(electricityUsdPerKwh, 6),
      revenueUsdPerDay: round(revenueUsdPerDay, 6),
      poolFeePct: round(poolFeePct, 6),
      hostingUsdPerDay: round(hostingUsdPerDay, 6),
      hardwarePriceUsd: hardwarePriceUsd == null ? null : round(hardwarePriceUsd, 6),
      shippingUsd: shippingUsd == null ? null : round(shippingUsd, 6),
      vatUsd: vatUsd == null ? null : round(vatUsd, 6),
      otherOneTimeUsd: otherOneTimeUsd == null ? null : round(otherOneTimeUsd, 6),
    },
    daily: {
      electricityUsdPerDay: round(electricityUsdPerDay, 6),
      poolFeeUsdPerDay: round(poolFeeUsdPerDay, 6),
      hostingUsdPerDay: round(hostingUsdPerDay, 6),
      totalDailyCostUsd: round(totalDailyCostUsd, 6),
    },
    totals: {
      netProfitUsdPerDay: round(netProfitUsdPerDay, 6),
      grossMarginPct: grossMarginPct == null ? null : round(grossMarginPct, 4),
      roiDays,
      capexTotalUsd: capexTotalUsd == null ? null : round(capexTotalUsd, 6),
    },
  };
}

/**
 * Payback date helper (optional).
 * Returns an ISO date string (YYYY-MM-DD) if ROI is computable.
 */
export function computePaybackDate(args: { computedAt: Date; roiDays: number | null }) {
  const { computedAt, roiDays } = args;
  if (!roiDays || roiDays <= 0) return null;

  const d = new Date(computedAt);
  d.setDate(d.getDate() + roiDays);

  // YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
