import { prisma } from "@/lib/db";

export type FxRates = Record<string, number>; // currency -> (currency per 1 USD)

export async function getLatestFxRates(): Promise<FxRates | null> {
  const latest = await prisma.fxRateSnapshot.findFirst({
    orderBy: { fetchedAt: "desc" },
  });
  if (!latest) return null;

  const ratesJson = latest.rates as any;
  if (!ratesJson || typeof ratesJson !== "object") return null;

  const out: FxRates = {};
  for (const [k, v] of Object.entries(ratesJson)) {
    const n = toNumber(v);
    if (n != null && n > 0) out[String(k).toUpperCase()] = n;
  }
  out["USD"] = 1;
  return out;
}

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

/**
 * ✅ Enterprise-safe numeric parsing for Prisma Decimal + strings + numbers.
 * - Handles Prisma.Decimal (Decimal.js-like): .toNumber() / .toString()
 * - Handles strings with commas ("1,234.56")
 * - Returns null for invalid values
 */
export function toNumber(v: unknown): number | null {
  if (v == null) return null;

  // Fast path: number
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  // Bigint path
  if (typeof v === "bigint") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // String path
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;

    // remove commas (e.g. "1,234.56")
    const cleaned = s.replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  // Object path: Prisma Decimal / Decimal.js-like
  if (typeof v === "object") {
    const anyV = v as any;

    // Decimal.js and Prisma.Decimal often expose toNumber()
    if (typeof anyV.toNumber === "function") {
      const n = anyV.toNumber();
      return typeof n === "number" && Number.isFinite(n) ? n : null;
    }

    // Fall back to string conversion
    if (typeof anyV.toString === "function") {
      const s = String(anyV.toString()).trim();
      if (!s) return null;
      const cleaned = s.replace(/,/g, "");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }

    return null;
  }

  // boolean/symbol/function etc
  return null;
}

export function convertToUsd(
  amount: number,
  currency: string,
  rates: FxRates | null
): number | null {
  const c = currency.toUpperCase();
  if (c === "USD") return amount;
  if (!rates) return null;
  const r = rates[c];
  if (!r || r <= 0) return null;
  return amount / r;
}

export function convertUsdToCurrency(
  usd: number,
  currency: string,
  rates: FxRates | null
): number | null {
  const c = currency.toUpperCase();
  if (c === "USD") return usd;
  if (!rates) return null;
  const r = rates[c];
  if (!r || r <= 0) return null;
  return usd * r;
}

/**
 * ⚠️ NOTE:
 * This helper is still valid, but now that your snapshot stores net profit already
 * (profitUsdPerDay = NET after costs), you should prefer:
 * - computeUserProfitFromSnapshotUsingBreakdown() (if you have breakdown)
 * - or only use this for "electricity-only what-if" deltas.
 */
export function computeUserProfitFromSnapshot(args: {
  revenueUsdPerDay: number;
  baselineElectricityUsdPerDay: number;
  baselineElectricityUsdPerKwh: number;
  userElectricityUsdPerKwh: number;
}) {
  const {
    revenueUsdPerDay,
    baselineElectricityUsdPerDay,
    baselineElectricityUsdPerKwh,
    userElectricityUsdPerKwh,
  } = args;

  const ratio =
    baselineElectricityUsdPerKwh > 0
      ? userElectricityUsdPerKwh / baselineElectricityUsdPerKwh
      : 1;

  const userElectricityUsdPerDay = baselineElectricityUsdPerDay * ratio;
  const userProfitUsdPerDay = revenueUsdPerDay - userElectricityUsdPerDay;

  return { userElectricityUsdPerDay, userProfitUsdPerDay };
}

/** ---------- NiceHash paying map in Settings ---------- */

export type NiceHashPayingSettingsValue = {
  fetchedAt: string;
  source: string;
  paying: Record<string, number>;
};

export function normalizeNiceHashAlgoKey(key: string) {
  return String(key ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function getNiceHashPayingSettings(): Promise<NiceHashPayingSettingsValue | null> {
  const row = await prisma.settings.findUnique({
    where: { key: "NICEHASH_PAYING_MAP" },
  });
  if (!row) return null;

  const v: any = row.value;
  if (!v || typeof v !== "object") return null;

  const fetchedAt = String(v.fetchedAt ?? "");
  const source = String(v.source ?? "nicehash");
  const payingRaw = v.paying;

  if (!payingRaw || typeof payingRaw !== "object") return null;

  const paying: Record<string, number> = {};
  for (const [k, val] of Object.entries(payingRaw)) {
    const n = toNumber(val);
    if (n != null && n > 0) paying[String(k).toUpperCase()] = n;
  }

  return { fetchedAt, source, paying };
}
