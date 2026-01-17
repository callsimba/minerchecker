export type SpeedBaseUnit = "H/s" | "Sol/s";

const PREFIX: Record<string, number> = {
  "": 1,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
};

export function computeElectricityUsdPerDay(powerW: number, electricityUsdPerKwh: number) {
  if (!Number.isFinite(powerW) || powerW <= 0) return 0;
  if (!Number.isFinite(electricityUsdPerKwh) || electricityUsdPerKwh < 0) return 0;
  return (powerW / 1000) * 24 * electricityUsdPerKwh;
}

export function parseSpeedToBase(hashrateStr: string, unitStr: string): { value: number; baseUnit: SpeedBaseUnit } | null {
  const n = Number(hashrateStr);
  if (!Number.isFinite(n) || n <= 0) return null;

  const u0 = (unitStr ?? "").trim();
  if (!u0) return null;

  const u = u0.toUpperCase().replace(/\s+/g, "");

  // Normalize common forms: "TH/S", "T H/s", "MSOL/S"
  const noPerSec = u.replace("/S", "");

  // Detect Sol/s
  const isSol = noPerSec.includes("SOL");
  const baseUnit: SpeedBaseUnit = isSol ? "Sol/s" : "H/s";

  // Remove base token (SOL or H)
  let mag = noPerSec;
  if (isSol) {
    mag = mag.replace("SOL", ""); // "K" from "KSOL"
  } else {
    // Handle "H", sometimes "HS" shows up in messy data, normalize both
    mag = mag.replace("HS", "H");
    mag = mag.replace("H", "");
  }

  // mag now should be prefix like "", K, M, G, T...
  const prefix = mag;
  const factor = PREFIX[prefix] ?? null;
  if (factor == null) return null;

  return { value: n * factor, baseUnit };
}

/**
 * NiceHash paying is documented as sat/(H|Sol|G)/day.
 * If our base speed is H/s or Sol/s, satPerUnitPerDay * speedBase => sat/day
 */
export function computeRevenueUsdPerDayFromNiceHash(args: {
  payingSatPerUnitPerDay: number;
  speedBasePerSec: number;
  btcUsd: number;
}) {
  const { payingSatPerUnitPerDay, speedBasePerSec, btcUsd } = args;

  if (!Number.isFinite(payingSatPerUnitPerDay) || payingSatPerUnitPerDay <= 0) return 0;
  if (!Number.isFinite(speedBasePerSec) || speedBasePerSec <= 0) return 0;
  if (!Number.isFinite(btcUsd) || btcUsd <= 0) return 0;

  const satPerDay = payingSatPerUnitPerDay * speedBasePerSec;
  const btcPerDay = satPerDay / 1e8;
  return btcPerDay * btcUsd;
}
