export const dynamic = "force-dynamic";

type TipResp = {
  tipHeight: number | null;
  avgBlockSeconds: number;
  nextHalvingHeight: number;
  blocksRemaining: number | null;
  secondsRemainingEstimate: number | null;
  sources: { tip?: string; avg?: string };
  fetchedAt: string;
};

async function fetchTextNumber(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const txt = await res.text();
    const n = Number(txt);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function fetchAvgFromMempool(sample = 20): Promise<number | null> {
  try {
    const res = await fetch("https://mempool.space/api/v1/blocks", { cache: "no-store" });
    if (!res.ok) return null;
    const blocks: Array<{ height: number; timestamp: number }> = await res.json();

    const sliced = blocks.slice(0, Math.max(6, Math.min(sample, blocks.length)));
    const times = sliced.map((b) => Number(b.timestamp)).filter((t) => Number.isFinite(t));
    if (times.length < 2) return null;

    // newest-first
    let sum = 0;
    let count = 0;
    for (let i = 0; i < times.length - 1; i++) {
      const newer = times[i];
      const older = times[i + 1];
      const dt = older - newer;
      if (dt > 0 && dt < 3600) {
        sum += dt;
        count++;
      }
    }
    if (!count) return null;
    const avg = sum / count;
    return Math.min(900, Math.max(300, avg));
  } catch {
    return null;
  }
}

async function fetchAvgFromBlockstream(sample = 10): Promise<number | null> {
  try {
    const res = await fetch("https://blockstream.info/api/blocks", { cache: "no-store" });
    if (!res.ok) return null;
    // blockstream returns array of latest blocks; has "timestamp"
    const blocks: Array<{ timestamp: number }> = await res.json();
    const sliced = blocks.slice(0, Math.max(6, Math.min(sample, blocks.length)));
    const times = sliced.map((b) => Number(b.timestamp)).filter((t) => Number.isFinite(t));
    if (times.length < 2) return null;

    // newest-first
    let sum = 0;
    let count = 0;
    for (let i = 0; i < times.length - 1; i++) {
      const newer = times[i];
      const older = times[i + 1];
      const dt = older - newer;
      if (dt > 0 && dt < 3600) {
        sum += dt;
        count++;
      }
    }
    if (!count) return null;
    const avg = sum / count;
    return Math.min(900, Math.max(300, avg));
  } catch {
    return null;
  }
}

export async function GET() {
  const nextHalvingHeight = 1_050_000;

  // Tip height: try multiple sources
  const mempoolTip = await fetchTextNumber("https://mempool.space/api/blocks/tip/height");
  const blockstreamTip = mempoolTip == null
    ? await fetchTextNumber("https://blockstream.info/api/blocks/tip/height")
    : null;

  const tipHeight = mempoolTip ?? blockstreamTip ?? null;

  // Avg block seconds: try mempool, then blockstream, then default
  const avgMempool = await fetchAvgFromMempool(20);
  const avgBlockstream = avgMempool == null ? await fetchAvgFromBlockstream(10) : null;
  const avgBlockSeconds = avgMempool ?? avgBlockstream ?? 600;

  const blocksRemaining = tipHeight == null ? null : Math.max(0, nextHalvingHeight - tipHeight);

  const secondsRemainingEstimate =
    blocksRemaining == null ? null : Math.max(0, Math.round(blocksRemaining * avgBlockSeconds));

  const body: TipResp = {
    tipHeight,
    avgBlockSeconds,
    nextHalvingHeight,
    blocksRemaining,
    secondsRemainingEstimate,
    sources: {
      tip: mempoolTip != null ? "mempool.space" : blockstreamTip != null ? "blockstream.info" : undefined,
      avg: avgMempool != null ? "mempool.space" : avgBlockstream != null ? "blockstream.info" : "default",
    },
    fetchedAt: new Date().toISOString(),
  };

  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
