import data from "@/coins_algorithms.json";

type CoinAlgo = {
  coin: string;
  algorithm: string;
};

const items = (data as any).items as CoinAlgo[];

function norm(s: string) {
  return String(s ?? "").trim().toLowerCase();
}

function baseAlgo(s: string) {
  // "Equihash (200,9)" -> "equihash"
  return norm(s).split("(")[0].trim();
}

function pushUnique(map: Map<string, string[]>, key: string, coin: string) {
  if (!key || !coin) return;
  const arr = map.get(key) ?? [];
  if (!arr.includes(coin)) arr.push(coin);
  map.set(key, arr);
}

// Build lookup tables once (module init)
const byExact = new Map<string, string[]>();
const byBase = new Map<string, string[]>();

for (const it of items ?? []) {
  const algoExact = norm(it.algorithm);
  const algoBase = baseAlgo(it.algorithm);
  const coin = norm(it.coin); // keep coins normalized to match your public/coins filenames

  pushUnique(byExact, algoExact, coin);
  pushUnique(byBase, algoBase, coin);
}

export function getCoinsForAlgorithm(algorithmName: string) {
  const a = norm(algorithmName);
  if (!a) return [];

  // 1) Try exact match first (fast + precise)
  const exact = byExact.get(a);
  if (exact && exact.length) return exact;

  // 2) Fallback: base match (handles "Equihash" vs "Equihash (200,9)")
  const b = baseAlgo(algorithmName);
  const base = byBase.get(b);
  return base ?? [];
}
function normalizeAlgoKey(input: string) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "") // ✅ remove "(200,9)" etc
    .replace(/[^a-z0-9]+/g, "");   // ✅ keep it consistent
}
