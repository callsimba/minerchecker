export type NiceHashPayingMap = Record<string, number>; // ALGO -> paying

export function normalizeNiceHashAlgoKey(key: string) {
  return String(key ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Backward/compat export used by cron route.
 * Internal Algorithm.key values tend to be lower-case/sluggy; NiceHash uses uppercase keys.
 */
export function normalizeAlgoKeyForNiceHash(key: string) {
  return normalizeNiceHashAlgoKey(key);
}

export async function fetchNiceHashPayingMap(): Promise<NiceHashPayingMap> {
  const url = "https://api2.nicehash.com/main/api/v2/public/simplemultialgo/info";

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`NiceHash failed: ${res.status}`);

  const json: any = await res.json();
  const arr: any[] = Array.isArray(json?.miningAlgorithms)
    ? json.miningAlgorithms
    : [];

  const out: NiceHashPayingMap = {};
  for (const r of arr) {
    const algo = String(r?.algorithm ?? "").trim().toUpperCase();
    const paying = Number(r?.paying);
    if (!algo) continue;
    if (!Number.isFinite(paying) || paying <= 0) continue;
    out[algo] = paying;
  }

  return out;
}
