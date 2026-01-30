// src/server/profitability/math.ts

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

export function parseSpeedToBase(
  hashrateStr: string,
  unitStr: string
): { value: number; baseUnit: SpeedBaseUnit } | null {
  const n = Number(hashrateStr);
  if (!Number.isFinite(n) || n <= 0) return null;

  const u0 = (unitStr ?? "").trim();
  if (!u0) return null;

  const u = u0.toUpperCase().replace(/\s+/g, "");
  const noPerSec = u.replace("/S", "").replace("/SEC", "").replace("/SECOND", "");

  const isSol = noPerSec.includes("SOL");
  const baseUnit: SpeedBaseUnit = isSol ? "Sol/s" : "H/s";

  let mag = noPerSec;
  if (isSol) {
    mag = mag.replace("SOL", "");
  } else {
    mag = mag.replace("HS", "H");
    mag = mag.replace("H", "");
  }

  const prefix = mag;
  const factor = PREFIX[prefix] ?? null;
  if (factor == null) return null;

  return { value: n * factor, baseUnit };
}

/**
 * NiceHash "paying" is typically interpreted as satoshi per unit of hashrate per day
 * on their "simplemultialgo/info" endpoint.
 *
 * If your project standard is PER-SECOND, pass payingSatPerUnitPerSec.
 * If you accidentally pass PER-DAY, we still support it via payingSatPerUnitPerDay.
 */
export function computeRevenueUsdPerDayFromNiceHash(args: {
  payingSatPerUnitPerSec?: number;
  payingSatPerUnitPerDay?: number;
  speedBasePerSec: number;
  btcUsd: number;
}) {
  const speed = args.speedBasePerSec;
  const btcUsd = args.btcUsd;

  if (!Number.isFinite(speed) || speed <= 0) return 0;
  if (!Number.isFinite(btcUsd) || btcUsd <= 0) return 0;

  let payingPerDay: number | null = null;

  if (Number.isFinite(args.payingSatPerUnitPerDay as number) && (args.payingSatPerUnitPerDay as number) > 0) {
    payingPerDay = Number(args.payingSatPerUnitPerDay);
  } else if (
    Number.isFinite(args.payingSatPerUnitPerSec as number) &&
    (args.payingSatPerUnitPerSec as number) > 0
  ) {
    payingPerDay = Number(args.payingSatPerUnitPerSec) * 86400;
  }

  if (payingPerDay == null) return 0;

  const satPerDay = payingPerDay * speed;
  const btcPerDay = satPerDay / 1e8;
  return btcPerDay * btcUsd;
}
