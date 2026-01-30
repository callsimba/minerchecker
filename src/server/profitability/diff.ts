// src/server/profitability/diff.ts
import { prisma } from "@/lib/db";

type Maybe<T> = T | null | undefined;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numStr(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pctChange(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null) return null;
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export type SnapshotCoinLite = {
  id?: string;
  key?: string;
  symbol?: string;
  name?: string;
};

export type SnapshotLite = {
  computedAt: Date;

  // stored as strings in your schema
  revenueUsdPerDay?: string | null;
  electricityUsdPerDay?: string | null;
  profitUsdPerDay?: string | null;

  // optional new fields
  roiDays?: number | null;
  breakdown?: any | null; // Json
  bestCoin?: SnapshotCoinLite | null;
  bestCoinId?: string | null;
  bestCoinConfidence?: number | null;
  bestCoinReason?: string | null;
};

export type BreakdownLite = {
  revenueUsdPerDay: number | null;
  electricityUsdPerDay: number | null;
  poolFeeUsdPerDay: number | null;
  hostingUsdPerDay: number | null;
  netProfitUsdPerDay: number | null;
  roiDays: number | null;
  paybackDate: string | null;
};

export type DeltaField = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
};

export type ProfitabilityDiff = {
  currentAt: string;
  previousAt: string;

  // money components
  revenueUsdPerDay: DeltaField;
  electricityUsdPerDay: DeltaField;
  poolFeeUsdPerDay: DeltaField;
  hostingUsdPerDay: DeltaField;
  netProfitUsdPerDay: DeltaField;

  // ROI
  roiDays: {
    current: number | null;
    previous: number | null;
    delta: number | null;
  };
  paybackDate: {
    current: string | null;
    previous: string | null;
    changed: boolean;
  };

  // Best coin
  bestCoin: {
    current: { symbol: string | null; name: string | null; id: string | null };
    previous: { symbol: string | null; name: string | null; id: string | null };
    changed: boolean;
    confidence: {
      current: number | null;
      previous: number | null;
      delta: number | null;
    };
    reason: {
      current: string | null;
      previous: string | null;
    };
  };
};

function extractBreakdown(s: SnapshotLite): BreakdownLite {
  // Prefer breakdown JSON if present (your compute writes it)
  const b: any = s.breakdown ?? null;

  // Try to read your costs.ts structure:
  // breakdown.inputs.revenueUsdPerDay
  // breakdown.daily.electricityUsdPerDay / poolFeeUsdPerDay / hostingUsdPerDay
  // breakdown.totals.netProfitUsdPerDay / roiDays
  const revenueFromB = num(b?.inputs?.revenueUsdPerDay);
  const elecFromB = num(b?.daily?.electricityUsdPerDay);
  const poolFromB = num(b?.daily?.poolFeeUsdPerDay);
  const hostFromB = num(b?.daily?.hostingUsdPerDay);
  const netFromB = num(b?.totals?.netProfitUsdPerDay);
  const roiFromB = num(b?.totals?.roiDays);

  // Fallbacks from snapshot fields
  const revenueSnap = numStr(s.revenueUsdPerDay);
  const elecSnap = numStr(s.electricityUsdPerDay);
  const profitSnap = numStr(s.profitUsdPerDay);

  const revenue = revenueFromB ?? revenueSnap;
  const electricity = elecFromB ?? elecSnap;

  // If breakdown missing pool/hosting, try infer:
  // netProfit ≈ profitUsdPerDay (your compute now writes net to profitUsdPerDay)
  // so pool+hosting ≈ revenue - electricity - net
  const net = netFromB ?? profitSnap;
  let poolFee = poolFromB;
  let hosting = hostFromB;

  if (poolFee == null && hosting == null && revenue != null && electricity != null && net != null) {
    const otherDaily = revenue - electricity - net;
    // We can't split pool vs hosting if not stored; keep poolFee as otherDaily and hosting as 0
    // so UI at least shows “fees/hosting total” rather than lying.
    poolFee = otherDaily;
    hosting = 0;
  }

  return {
    revenueUsdPerDay: revenue ?? null,
    electricityUsdPerDay: electricity ?? null,
    poolFeeUsdPerDay: poolFee ?? null,
    hostingUsdPerDay: hosting ?? null,
    netProfitUsdPerDay: net ?? null,
    roiDays: (s.roiDays ?? null) ?? (roiFromB ?? null),
    paybackDate: typeof b?.paybackDate === "string" ? b.paybackDate : null,
  };
}

function deltaField(curr: number | null, prev: number | null): DeltaField {
  const d = curr == null || prev == null ? null : curr - prev;
  return {
    current: curr,
    previous: prev,
    delta: d,
    deltaPct: pctChange(curr, prev),
  };
}

/**
 * Compare two snapshots (current vs previous).
 * Uses breakdown JSON when available; otherwise falls back to snapshot numeric fields.
 */
export function diffProfitabilitySnapshots(current: SnapshotLite, previous: SnapshotLite): ProfitabilityDiff {
  const c = extractBreakdown(current);
  const p = extractBreakdown(previous);

  const cCoinId = (current.bestCoinId ?? (current.bestCoin as any)?.id ?? null) as string | null;
  const pCoinId = (previous.bestCoinId ?? (previous.bestCoin as any)?.id ?? null) as string | null;

  const cSym = (current.bestCoin?.symbol ?? null) as string | null;
  const pSym = (previous.bestCoin?.symbol ?? null) as string | null;

  const cName = (current.bestCoin?.name ?? null) as string | null;
  const pName = (previous.bestCoin?.name ?? null) as string | null;

  const cConf = num(current.bestCoinConfidence) ?? null;
  const pConf = num(previous.bestCoinConfidence) ?? null;

  const paybackChanged = (c.paybackDate ?? null) !== (p.paybackDate ?? null);

  return {
    currentAt: current.computedAt.toISOString(),
    previousAt: previous.computedAt.toISOString(),

    revenueUsdPerDay: deltaField(c.revenueUsdPerDay, p.revenueUsdPerDay),
    electricityUsdPerDay: deltaField(c.electricityUsdPerDay, p.electricityUsdPerDay),
    poolFeeUsdPerDay: deltaField(c.poolFeeUsdPerDay, p.poolFeeUsdPerDay),
    hostingUsdPerDay: deltaField(c.hostingUsdPerDay, p.hostingUsdPerDay),
    netProfitUsdPerDay: deltaField(c.netProfitUsdPerDay, p.netProfitUsdPerDay),

    roiDays: {
      current: c.roiDays,
      previous: p.roiDays,
      delta: c.roiDays == null || p.roiDays == null ? null : c.roiDays - p.roiDays,
    },

    paybackDate: {
      current: c.paybackDate ?? null,
      previous: p.paybackDate ?? null,
      changed: paybackChanged,
    },

    bestCoin: {
      current: { id: cCoinId, symbol: cSym, name: cName },
      previous: { id: pCoinId, symbol: pSym, name: pName },
      changed: (cCoinId && pCoinId) ? cCoinId !== pCoinId : (cSym ?? "") !== (pSym ?? ""),
      confidence: {
        current: cConf,
        previous: pConf,
        delta: cConf == null || pConf == null ? null : cConf - pConf,
      },
      reason: {
        current: (current.bestCoinReason ?? null) as string | null,
        previous: (previous.bestCoinReason ?? null) as string | null,
      },
    },
  };
}

/**
 * Pick a “yesterday” snapshot from a list (already sorted desc by computedAt).
 * - Prefer closest to now-24h
 * - Otherwise, fall back to the 2nd newest
 */
export function pickPreviousSnapshot(
  snapsDesc: SnapshotLite[],
  now: Date = new Date(),
  targetHoursAgo = 24
): SnapshotLite | null {
  if (!snapsDesc.length) return null;
  if (snapsDesc.length === 1) return null;

  const target = new Date(now.getTime() - targetHoursAgo * 60 * 60 * 1000).getTime();

  // Ignore the newest snapshot (index 0)
  let best: { s: SnapshotLite; score: number } | null = null;

  for (let i = 1; i < snapsDesc.length; i++) {
    const t = snapsDesc[i].computedAt.getTime();
    const score = Math.abs(t - target);
    if (!best || score < best.score) best = { s: snapsDesc[i], score };
  }

  return best?.s ?? snapsDesc[1] ?? null;
}

/**
 * Convenience: fetch current + previous snapshot for a machine, then compute diff.
 * This is optional but super handy for “What changed since yesterday?” on the machine page.
 */
export async function getMachineProfitabilityDiff(args: {
  machineId: string;
  now?: Date;
  lookbackDays?: number; // how far back to fetch history for picking "yesterday"
}) {
  const now = args.now ?? new Date();
  const lookbackDays = args.lookbackDays ?? 3;
  const since = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const snaps = await prisma.profitabilitySnapshot.findMany({
    where: { machineId: args.machineId, computedAt: { gte: since } },
    orderBy: { computedAt: "desc" },
    take: 200,
    include: { bestCoin: true },
  });

  const current = snaps[0] as any as SnapshotLite | undefined;
  if (!current) return null;

  const prev = pickPreviousSnapshot(snaps as any as SnapshotLite[], now, 24);
  if (!prev) return null;

  return diffProfitabilitySnapshots(current, prev);
}
