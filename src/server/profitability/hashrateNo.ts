// src/server/profitability/hashrateNo.ts

export type HashrateNoEstimate = {
  coin: string; // e.g. "alph"
  revenueUsdPerDayPerBase: number; // USD/day per BASE (H/s or Sol/s or Graph/s)
  unitDetected?: string; // e.g. "Gh/s"
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes (positive results)
const NEGATIVE_TTL_MS = 60 * 1000; // 1 minute (failed lookups)
const FETCH_TIMEOUT_MS = 8_000; // 8s timeout

type CacheEntry =
  | { at: number; ok: true; est: HashrateNoEstimate }
  | { at: number; ok: false; est: null };

const cache = new Map<string, CacheEntry>();

function normCoinKey(v: string) {
  return String(v ?? "").trim().toLowerCase();
}

function unitToBaseMultiplier(unitRaw: string): number | null {
  const u = String(unitRaw ?? "").trim().toLowerCase().replace(/\s+/g, "");

  // Hashrate units
  if (u === "h/s") return 1;
  if (u === "kh/s") return 1e3;
  if (u === "mh/s") return 1e6;
  if (u === "gh/s") return 1e9;
  if (u === "th/s") return 1e12;
  if (u === "ph/s") return 1e15;
  if (u === "eh/s") return 1e18;

  // Equihash-like
  if (u === "sol/s") return 1;
  if (u === "ksol/s") return 1e3;
  if (u === "msol/s") return 1e6;
  if (u === "gsol/s") return 1e9;

  // Cuckatoo-like
  if (u === "graph/s") return 1;
  if (u === "kgraph/s") return 1e3;
  if (u === "mgraph/s") return 1e6;
  if (u === "ggraph/s") return 1e9;

  return null;
}

function parseRevenuePerUnitFromHtml(
  html: string
): { revenue: number; unit: string } | null {
  /**
   * Hashrate.no coin pages often render like:
   * "Est. Revenue ... $0.000252 ... per Gh/s"
   * Sometimes includes "per 1 Gh/s" or spaces/newlines.
   */
  const m = html.match(
    /Est\.?\s*Revenue[\s\S]{0,600}?\$?\s*([0-9]+(?:\.[0-9]+)?)\s*[\s\S]{0,200}?\bper\b[\s\S]{0,40}?(?:1\s*)?([A-Za-z0-9]+\/[A-Za-z]+)\b/i
  );
  if (!m) return null;

  const revenue = Number(m[1]);
  const unit = String(m[2] ?? "").trim();

  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  if (!unit) return null;

  return { revenue, unit };
}

function getFromCache(coin: string): HashrateNoEstimate | null | undefined {
  const entry = cache.get(coin);
  if (!entry) return undefined;

  const ttl = entry.ok ? CACHE_TTL_MS : NEGATIVE_TTL_MS;
  if (Date.now() - entry.at > ttl) {
    cache.delete(coin);
    return undefined;
  }

  return entry.ok ? entry.est : null;
}

/**
 * Token-free fallback:
 * Fetch hashrate.no coin page and extract "Est. Revenue $X per <unit>"
 * Returns normalized USD/day per BASE unit (H/s, Sol/s, Graph/s).
 */
export async function fetchHashrateNoRevenueUsdPerDayPerBase(
  coinKey: string
): Promise<HashrateNoEstimate | null> {
  const coin = normCoinKey(coinKey);
  if (!coin) return null;

  const cached = getFromCache(coin);
  if (cached !== undefined) return cached;

  const url = `https://hashrate.no/coins/${encodeURIComponent(coin)}`;

  // Timeout protection
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ac.signal,
      headers: {
        // Some CDNs respond better with a UA
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
      },
    });

    if (!res.ok) {
      cache.set(coin, { at: Date.now(), ok: false, est: null });
      return null;
    }

    const html = await res.text();
    const parsed = parseRevenuePerUnitFromHtml(html);
    if (!parsed) {
      cache.set(coin, { at: Date.now(), ok: false, est: null });
      return null;
    }

    const mult = unitToBaseMultiplier(parsed.unit);
    if (!mult) {
      cache.set(coin, { at: Date.now(), ok: false, est: null });
      return null;
    }

    // parsed.revenue is USD/day per <unit>
    // normalize to USD/day per base by dividing by multiplier
    const revenueUsdPerDayPerBase = parsed.revenue / mult;

    if (!Number.isFinite(revenueUsdPerDayPerBase) || revenueUsdPerDayPerBase <= 0) {
      cache.set(coin, { at: Date.now(), ok: false, est: null });
      return null;
    }

    const est: HashrateNoEstimate = {
      coin,
      revenueUsdPerDayPerBase,
      unitDetected: parsed.unit,
    };

    cache.set(coin, { at: Date.now(), ok: true, est });
    return est;
  } catch {
    // network error / timeout / blocked
    cache.set(coin, { at: Date.now(), ok: false, est: null });
    return null;
  } finally {
    clearTimeout(t);
  }
}
