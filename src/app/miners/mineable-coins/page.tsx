import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { getCoinLogoUrl } from "@/lib/coin-logos";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseDecimalString(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default async function MineableCoinsPage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const q = String(firstParam(sp.q) ?? "").trim();
  const view = String(firstParam(sp.view) ?? "algo").toLowerCase(); // 'algo' | 'coin'

  // --- 1) Algorithms + machine counts (for ranking)
  const algorithmsRaw = await prisma.algorithm.findMany({
    include: { _count: { select: { machines: true } } },
    orderBy: { name: "asc" },
  });

  // --- 2) Catalog coins (whatever exists in your DB)
  const catalogCoinsRaw = await prisma.coin.findMany({
    include: {
      algorithm: true,
      _count: { select: { miners: true } }, // MachineCoin relations count
    },
    orderBy: { symbol: "asc" },
  });

  // --- 3) Observed coins from recent snapshots (dominance)
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

  const observedSnaps = await prisma.profitabilitySnapshot.findMany({
    where: {
      bestCoinId: { not: null },
      computedAt: { gte: since },
    },
    select: {
      bestCoin: { select: { id: true, symbol: true, name: true, algorithmId: true } },
      machine: { select: { algorithmId: true } },
      profitUsdPerDay: true,
      revenueUsdPerDay: true,
    },
    take: 50_000,
    orderBy: { computedAt: "desc" },
  });

  type ObservedAgg = {
    coinId: string;
    symbol: string;
    name: string;
    algorithmId: string;
    seenCount: number;
    avgProfitUsd: number;
    avgRevenueUsd: number;
  };

  const observedByCoinId = new Map<string, ObservedAgg>();
  const algoCoinFreq = new Map<string, Map<string, number>>();

  for (const s of observedSnaps) {
    if (!s.bestCoin) continue;

    const coinId = s.bestCoin.id;
    const algoId = s.bestCoin.algorithmId || s.machine.algorithmId;

    const profit = parseDecimalString(s.profitUsdPerDay, 0);
    const revenue = parseDecimalString(s.revenueUsdPerDay, 0);

    const existing = observedByCoinId.get(coinId);
    if (!existing) {
      observedByCoinId.set(coinId, {
        coinId,
        symbol: s.bestCoin.symbol,
        name: s.bestCoin.name,
        algorithmId: algoId,
        seenCount: 1,
        avgProfitUsd: profit,
        avgRevenueUsd: revenue,
      });
    } else {
      const n = existing.seenCount + 1;
      existing.seenCount = n;
      existing.avgProfitUsd = existing.avgProfitUsd + (profit - existing.avgProfitUsd) / n;
      existing.avgRevenueUsd = existing.avgRevenueUsd + (revenue - existing.avgRevenueUsd) / n;
    }

    if (!algoCoinFreq.has(algoId)) algoCoinFreq.set(algoId, new Map());
    const freq = algoCoinFreq.get(algoId)!;
    freq.set(coinId, (freq.get(coinId) ?? 0) + 1);
  }

  const catalogById = new Map(catalogCoinsRaw.map((c) => [c.id, c]));

  const mergedCoins = (() => {
    const out: Array<{
      id: string;
      symbol: string;
      name: string;
      algorithmId: string;
      algoName: string;
      blockTimeSec: number | null;
      minerCount: number;
      observedCount: number;
      avgProfitUsd: number | null;
      avgRevenueUsd: number | null;
      logoUrl: string | null;
      sourceTags: Array<"catalog" | "observed">;
    }> = [];

    for (const c of catalogCoinsRaw) {
      const obs = observedByCoinId.get(c.id);
      out.push({
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        algorithmId: c.algorithmId,
        algoName: c.algorithm.name,
        blockTimeSec: c.blockTimeSec ?? null,
        minerCount: c._count.miners ?? 0,
        observedCount: obs?.seenCount ?? 0,
        avgProfitUsd: obs ? obs.avgProfitUsd : null,
        avgRevenueUsd: obs ? obs.avgRevenueUsd : null,
        logoUrl: getCoinLogoUrl(c.symbol),
        sourceTags: obs ? ["catalog", "observed"] : ["catalog"],
      });
    }

    for (const obs of observedByCoinId.values()) {
      if (catalogById.has(obs.coinId)) continue;

      const algoName = algorithmsRaw.find((a) => a.id === obs.algorithmId)?.name ?? "Unknown";

      out.push({
        id: obs.coinId,
        symbol: obs.symbol,
        name: obs.name,
        algorithmId: obs.algorithmId,
        algoName,
        blockTimeSec: null,
        minerCount: 0,
        observedCount: obs.seenCount,
        avgProfitUsd: obs.avgProfitUsd,
        avgRevenueUsd: obs.avgRevenueUsd,
        logoUrl: getCoinLogoUrl(obs.symbol),
        sourceTags: ["observed"],
      });
    }

    const qq = q.toLowerCase();
    const filtered =
      view === "coin" && qq
        ? out.filter((c) => (c.symbol + " " + c.name).toLowerCase().includes(qq))
        : out;

    filtered.sort((a, b) => b.observedCount - a.observedCount || a.symbol.localeCompare(b.symbol));
    return filtered;
  })();

  const enrichedAlgos = algorithmsRaw
    .map((algo) => {
      const freq = algoCoinFreq.get(algo.id) ?? new Map<string, number>();

      const coinsForAlgo = mergedCoins
        .filter((c) => c.algorithmId === algo.id)
        .map((c) => ({ ...c, dominance: freq.get(c.id) ?? 0 }))
        .sort(
          (a, b) =>
            b.dominance - a.dominance ||
            b.observedCount - a.observedCount ||
            a.symbol.localeCompare(b.symbol)
        );

      return {
        id: algo.id,
        key: algo.key,
        name: algo.name,
        machineCount: algo._count.machines,
        coinCount: coinsForAlgo.length,
        coins: coinsForAlgo,
        dominantCoin: coinsForAlgo[0] ?? null,
      };
    })
    .filter((a) => a.machineCount > 0 || a.coinCount > 0)
    .sort((a, b) => b.machineCount - a.machineCount);

  const totalAlgos = enrichedAlgos.length;
  const totalCoins = mergedCoins.length;
  const totalMachines = enrichedAlgos.reduce((acc, a) => acc + a.machineCount, 0);

  return (
    <div className="min-h-screen bg-[#0b0e14] pb-20 text-slate-200">
      <header className="border-b border-white/5 bg-[#151a2a] pt-10 pb-8 px-4 md:px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Mineable Coins</h1>
              <p className="mt-2 text-slate-400 max-w-2xl">
                Coins + algorithms + real-world dominance from snapshots (last 30 days). This helps you see what’s actually showing up as best.
              </p>
            </div>

            <div className="flex gap-4">
              <div className="bg-[#0b0e14] border border-white/10 rounded-xl px-4 py-2">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Algorithms</div>
                <div className="text-lg font-bold text-white">{totalAlgos}</div>
              </div>
              <div className="bg-[#0b0e14] border border-white/10 rounded-xl px-4 py-2">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Coins</div>
                <div className="text-lg font-bold text-orange-400">{totalCoins}</div>
              </div>
              <div className="bg-[#0b0e14] border border-white/10 rounded-xl px-4 py-2 hidden sm:block">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Hardware Models</div>
                <div className="text-lg font-bold text-blue-400">{totalMachines}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            * “Observed” coins are derived from <span className="font-mono">ProfitabilitySnapshot.bestCoin</span> frequency.
            Catalog coins come from your <span className="font-mono">Coin</span> table.
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 mt-8">
        <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-4 mb-8 sticky top-4 z-30 shadow-2xl flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2 bg-[#0b0e14] p-1 rounded-xl border border-slate-800">
            <Link
              href="?view=algo"
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                view !== "coin" ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Algorithm Matrix
            </Link>
            <Link
              href="?view=coin"
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                view === "coin" ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Coin Directory
            </Link>
          </div>

          {view === "coin" && (
            <form className="relative group min-w-[260px]">
              <input type="hidden" name="view" value="coin" />
              <div className="absolute inset-y-0 left-3 flex items-center text-slate-500">🔍</div>
              <input
                name="q"
                defaultValue={q}
                placeholder="Find a coin..."
                className="w-full h-10 pl-9 pr-4 bg-[#0b0e14] border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 outline-none transition-colors"
              />
            </form>
          )}
        </div>

        {view !== "coin" && (
          <div className="bg-[#151a2a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0b0e14] text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5">
                    <th className="p-5">Algorithm</th>
                    <th className="p-5">Dominant (Observed)</th>
                    <th className="p-5">Top Coins</th>
                    <th className="p-5 text-right">ASIC Models</th>
                    <th className="p-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {enrichedAlgos.map((algo) => (
                    <tr key={algo.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-5">
                        <div className="font-bold text-white text-base">{algo.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{algo.key}</div>
                      </td>

                      <td className="p-5">
                        {algo.dominantCoin ? (
                          <div className="flex items-center gap-3">
                            {algo.dominantCoin.logoUrl ? (
                              <Image src={algo.dominantCoin.logoUrl} alt={algo.dominantCoin.symbol} width={24} height={24} className="rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px]">
                                {algo.dominantCoin.symbol[0]}
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-bold text-white">{algo.dominantCoin.name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-2">
                                <span>{algo.dominantCoin.symbol}</span>
                                <span className="text-[10px] text-emerald-400">
                                  {algo.dominantCoin.dominance > 0 ? `${algo.dominantCoin.dominance}x best` : "catalog"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-sm italic">Unknown</span>
                        )}
                      </td>

                      <td className="p-5">
                        <div className="flex flex-wrap gap-1.5 max-w-xl">
                          {algo.coins.slice(0, 10).map((c) => (
                            <div
                              key={c.id}
                              className="bg-[#0b0e14] border border-slate-700 px-2 py-1 rounded-md flex items-center gap-1.5"
                              title={`${c.name} • observed: ${c.observedCount}`}
                            >
                              {c.logoUrl ? <Image src={c.logoUrl} alt={c.symbol} width={12} height={12} className="rounded-full" /> : null}
                              <span className="text-xs font-medium text-slate-300">{c.symbol}</span>
                              {c.observedCount > 0 && <span className="text-[10px] text-slate-500">({c.observedCount})</span>}
                            </div>
                          ))}
                          {algo.coins.length > 10 && (
                            <span className="text-xs text-slate-500 self-center">+{algo.coins.length - 10} more</span>
                          )}
                        </div>
                      </td>

                      <td className="p-5 text-right">
                        <div className="text-lg font-bold text-white">{algo.machineCount}</div>
                        <div className="text-xs text-slate-500">Tracked</div>
                      </td>

                      <td className="p-5 text-right">
                        <Link
                          href={`/miners/asic-miners?algorithm=${algo.key}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          View Miners ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {enrichedAlgos.length === 0 && (
              <div className="p-12 text-center">
                <div className="text-4xl mb-4 opacity-50">🧊</div>
                <h3 className="text-white font-bold">No algorithm/coin data yet</h3>
                <p className="text-slate-500 mt-2 text-sm">
                  Seed coins or generate profitability snapshots to auto-discover dominant coins.
                </p>
              </div>
            )}
          </div>
        )}

        {view === "coin" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {mergedCoins.map((coin) => (
                <div
                  key={coin.id}
                  className="bg-[#151a2a] border border-slate-800 rounded-2xl p-5 hover:border-slate-600 transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col relative overflow-hidden group"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 bg-[#0b0e14] rounded-xl p-1 border border-slate-800 shrink-0 flex items-center justify-center">
                      {coin.logoUrl ? (
                        <Image src={coin.logoUrl} alt={coin.name} width={40} height={40} className="object-contain" />
                      ) : (
                        <span className="text-lg font-bold text-slate-600">{coin.symbol.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-lg leading-tight truncate">{coin.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded w-fit">{coin.symbol}</div>
                        {coin.observedCount > 0 ? (
                          <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            observed {coin.observedCount}x
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded">catalog</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <div className="bg-[#0b0e14] rounded p-2 border border-slate-800">
                      <div className="text-slate-500 mb-0.5">Algorithm</div>
                      <div className="text-white font-mono truncate" title={coin.algoName}>{coin.algoName}</div>
                    </div>
                    <div className="bg-[#0b0e14] rounded p-2 border border-slate-800">
                      <div className="text-slate-500 mb-0.5">Block Time</div>
                      <div className="text-white font-mono">{coin.blockTimeSec ? `${coin.blockTimeSec}s` : "—"}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <div className="bg-[#0b0e14] rounded p-2 border border-slate-800">
                      <div className="text-slate-500 mb-0.5">Linked Miners</div>
                      <div className="text-white font-mono">{coin.minerCount}</div>
                    </div>
                    <div className="bg-[#0b0e14] rounded p-2 border border-slate-800">
                      <div className="text-slate-500 mb-0.5">Avg Profit (USD)</div>
                      <div className="text-white font-mono">{coin.avgProfitUsd != null ? coin.avgProfitUsd.toFixed(2) : "—"}</div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Source: <span className="text-slate-300 font-semibold">{coin.sourceTags.join(" + ")}</span>
                    </div>

                    <Link
                      href={`/miners/asic-miners?coin=${encodeURIComponent(coin.symbol)}`}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                    >
                      Find Hardware →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {mergedCoins.length === 0 && (
              <div className="text-center py-20">
                <div className="text-4xl mb-4 opacity-50">🪙</div>
                <h3 className="text-white font-bold text-xl">No coins found</h3>
                <p className="text-slate-500 mt-2">Try a different search term.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
