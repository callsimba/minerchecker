// src/server/profitability/nicehash.ts

export type NiceHashPayingMap = Record<string, number>; // ALGO_KEY -> paying (satoshi/factor/sec)

export function normalizeNiceHashAlgoKey(key: string) {
  return String(key ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Export alias used across the project (cron + compute).
 * Internal Algorithm.key values tend to be lower-case/sluggy; NiceHash uses uppercase keys.
 */
export const normalizeAlgoKeyForNiceHash = normalizeNiceHashAlgoKey;

async function fetchJson(url: string, timeoutMs = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ac.signal,
      headers: {
        // Helps avoid occasional bot-block pages
        "User-Agent": "minerchecker/1.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`NiceHash failed: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchNiceHashPayingMap(): Promise<NiceHashPayingMap> {
  const url = "https://api2.nicehash.com/main/api/v2/public/simplemultialgo/info";

  const json: any = await fetchJson(url);
  const arr: any[] = Array.isArray(json?.miningAlgorithms) ? json.miningAlgorithms : [];

  const out: NiceHashPayingMap = {};

  for (const r of arr) {
    // NiceHash uses keys like "DAGGERHASHIMOTO". Normalize anyway for safety.
    const algoKey = normalizeNiceHashAlgoKey(String(r?.algorithm ?? ""));
    const paying = Number(r?.paying);

    if (!algoKey) continue;
    if (!Number.isFinite(paying) || paying <= 0) continue;

    out[algoKey] = paying;
  }

  return out;
}
