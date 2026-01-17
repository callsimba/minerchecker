export type BtcUsdResult = { usd: number; source: string };

async function fetchJson(url: string, timeoutMs = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fromCoinGecko(): Promise<number> {
  // CoinGecko simple price docs. :contentReference[oaicite:3]{index=3}
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
  const j: any = await fetchJson(url);
  const n = Number(j?.bitcoin?.usd);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid CoinGecko price");
  return n;
}

async function fromBinance(): Promise<number> {
  // Binance /api/v3/ticker/price endpoint. :contentReference[oaicite:4]{index=4}
  const url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT";
  const j: any = await fetchJson(url);
  const n = Number(j?.price);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid Binance price");
  return n;
}

async function fromCoinbase(): Promise<number> {
  const url = "https://api.coinbase.com/v2/prices/BTC-USD/spot";
  const j: any = await fetchJson(url);
  const n = Number(j?.data?.amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid Coinbase price");
  return n;
}

async function fromKraken(): Promise<number> {
  const url = "https://api.kraken.com/0/public/Ticker?pair=XBTUSD";
  const j: any = await fetchJson(url);
  const r = j?.result;
  const key = r ? Object.keys(r)[0] : null;
  const n = Number(key ? r[key]?.c?.[0] : NaN);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid Kraken price");
  return n;
}

const PROVIDERS: { name: string; get: () => Promise<number> }[] = [
  { name: "CoinGecko", get: fromCoinGecko },
  { name: "Binance", get: fromBinance },
  { name: "Coinbase", get: fromCoinbase },
  { name: "Kraken", get: fromKraken },
];

export async function getBtcUsdWithFallback(): Promise<BtcUsdResult> {
  let lastErr: unknown = null;

  for (const p of PROVIDERS) {
    try {
      const usd = await p.get();
      return { usd, source: p.name };
    } catch (e) {
      lastErr = e;
      // try next provider
    }
  }
  throw new Error(`All BTC/USD providers failed. Last error: ${String(lastErr)}`);
}
