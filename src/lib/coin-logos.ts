// src/lib/coin-logos.ts
/**
 * Single source of truth for coin logos.
 *
 * Your repo already contains logos in:
 *   /public/coins/*.webp
 *
 * So we DO NOT store coin.logoUrl in DB.
 * We resolve logos purely from symbol → local static asset.
 */

export const COIN_LOGO_BASES = new Set<string>([
  "aleo",
  "alph",
  "bcn",
  "btc",
  "btm",
  "ckb",
  "dash",
  "dcr",
  "doge",
  "etc",
  "grin",
  "grs",
  "hns",
  "ini",
  "kas",
  "kda",
  "lbc",
  "ltc",
  "mona",
  "nexa",
  "rxd",
  "sc",
  "scc",
  "scp",
  "sumo",
  "xmr",
  "xtm",
  "zec",
  "zen",
]);

/**
 * Aliases: SYMBOL -> base filename in /public/coins (no extension)
 * Add more here anytime you add more icons.
 */
export const COIN_LOGO_ALIASES: Record<string, string> = {
  BTC: "btc",
  BCH: "btc", // no bch in your folder yet
  XBT: "btc",

  DOGE: "doge",
  LTC: "ltc",
  KAS: "kas",
  ALPH: "alph",
  ALEO: "aleo",
  ETC: "etc",

  ZEC: "zec",
  ZEN: "zen",

  XMR: "xmr",
  NEXA: "nexa",
  CKB: "ckb",
  DASH: "dash",
  DCR: "dcr",
  HNS: "hns",
};

function normalizeSymbol(symbol: string) {
  return String(symbol ?? "").trim().toUpperCase();
}

/**
 * Returns a local static URL like: /coins/btc.webp
 * Returns null if we don't have a local icon for that symbol.
 */
export function getCoinLogoUrl(symbol: string): string | null {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;

  // Handle combined symbols like "DOGE+LTC"
  // We'll return null here (UI can fallback to initials),
  // or you can implement multi-icon rendering where needed.
  if (sym.includes("+") || sym.includes("/")) return null;

  const base = (COIN_LOGO_ALIASES[sym] ?? sym).toLowerCase();
  if (!base) return null;

  if (!COIN_LOGO_BASES.has(base)) return null;

  // Your repo uses .webp for all current coin icons
  return `/coins/${base}.webp`;
}
