import Link from "next/link";
import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/lib/db";
import {
  convertToUsd,
  convertUsdToCurrency,
  formatMoney,
  getLatestFxRates,
  toNumber,
} from "@/server/public";
import { computeElectricityUsdPerDay } from "@/server/profitability/math";
import { CoinStrip, type CoinLogo } from "@/components/coin-strip";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

function parseNum(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function getCoinLogos(): Promise<CoinLogo[]> {
  try {
    const dir = path.join(process.cwd(), "public", "coins");
    const files = await fs.readdir(dir);

    return files
      .filter((f) => f.toLowerCase().endsWith(".webp"))
      .sort((a, b) => a.localeCompare(b))
      .map((filename) => {
        const key = filename.replace(/\.webp$/i, "");
        const symbol = key.toUpperCase(); // matches Coin.symbol in your dataset (e.g., DOGE+LTC)
        const src = `/coins/${encodeURIComponent(filename)}`;
        return { key, symbol, src };
      });
  } catch {
    return [];
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const q = String(sp.q ?? "").trim();
  const algorithm = String(sp.algorithm ?? "").trim();
  const status = String(sp.status ?? "").trim();

  const currency = String(sp.currency ?? "USD").toUpperCase();
  const regionKey = String(sp.region ?? "GLOBAL").toUpperCase();
  const electricity = parseNum(String(sp.electricity ?? "0.10"), 0.10);

  // coin filter (set by clicking coin logos)
  const coin = String(sp.coin ?? "").trim();
  const coinSymbol = coin ? coin.toUpperCase() : "";

  const fxRates = await getLatestFxRates();
  const coinLogos = await getCoinLogos();

  const machines = await prisma.machine.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { manufacturer: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(algorithm ? { algorithm: { key: algorithm } } : {}),
      ...(status ? { status: status as any } : {}),

      ...(coinSymbol
        ? {
            canMineCoins: {
              some: {
                coin: {
                  symbol: { equals: coinSymbol, mode: "insensitive" },
                },
              },
            },
          }
        : {}),
    },
    include: {
      algorithm: true,
      vendorOfferings: {
        include: { vendor: true },
        where: { regionKey, inStock: true },
      },
      profitabilitySnapshots: {
        orderBy: { computedAt: "desc" },
        take: 1,
        include: { bestCoin: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const algorithms = await prisma.algorithm.findMany({
    orderBy: { name: "asc" },
    select: { key: true, name: true },
  });

  function getLowestPriceDisplay(offerings: any[]) {
    if (!offerings || offerings.length === 0) return null;

    let best: { usd: number } | null = null;

    for (const off of offerings) {
      const raw = toNumber(off.price);
      if (raw == null) continue;

      const usd = convertToUsd(raw, off.currency, fxRates);
      if (usd == null) continue;

      if (!best || usd < best.usd) best = { usd };
    }

    if (!best) return null;

    const display = convertUsdToCurrency(best.usd, currency, fxRates);
    if (display == null) return { amount: best.usd, currency: "USD" };
    return { amount: display, currency };
  }

  return (
    <main className="space-y-5">
      {/* Coin strip ABOVE the header card */}
      <CoinStrip coins={coinLogos} selectedSymbol={coinSymbol || undefined} />

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-[rgb(var(--accent-yellow)/0.75)]" />

        <h1 className="text-3xl font-semibold tracking-tight">MinerChecker</h1>
        <p className="mt-1.5 text-sm text-muted">
          Profitability snapshots + lowest vendor price (manual listings).
        </p>

        <form className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search miners…"
            className="h-11 rounded-xl border border-border bg-bg px-4 text-fg outline-none transition
focus:border-[rgb(var(--accent-yellow)/0.55)] focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)] md:col-span-2"
          />

          <select
            name="algorithm"
            defaultValue={algorithm}
            className="h-11 rounded-xl border border-border bg-bg px-4 text-fg outline-none transition
focus:border-[rgb(var(--accent-yellow)/0.55)] focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]"
          >
            <option value="">All algorithms</option>
            {algorithms.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name} ({a.key})
              </option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={status}
            className="h-11 rounded-xl border border-border bg-bg px-4 text-fg outline-none transition
focus:border-[rgb(var(--accent-yellow)/0.55)] focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]"
          >
            <option value="">All status</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="COMING_SOON">COMING_SOON</option>
            <option value="DISCONTINUED">DISCONTINUED</option>
          </select>

          <input
            name="electricity"
            defaultValue={String(electricity)}
            inputMode="decimal"
            placeholder="Electricity USD/kWh"
            className="h-11 rounded-xl border border-border bg-bg px-4 text-fg outline-none transition
focus:border-[rgb(var(--accent-yellow)/0.55)] focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]"
          />

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <input
              name="currency"
              defaultValue={currency}
              placeholder="Currency (USD)"
              className="h-11 rounded-xl border border-border bg-bg px-4 text-fg outline-none transition
focus:border-[rgb(var(--accent-yellow)/0.55)] focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]"
            />
            <input
              name="region"
              defaultValue={regionKey}
              placeholder="Region (GLOBAL)"
              className="h-11 rounded-xl border border-border bg-bg px-4 text-fg outline-none transition
focus:border-[rgb(var(--accent-yellow)/0.55)] focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]"
            />
          </div>

          {/* preserve coin filter on submit */}
          {coinSymbol ? <input type="hidden" name="coin" value={coinSymbol} /> : null}

          <button
            className="h-11 rounded-xl bg-[rgb(var(--accent-yellow))] px-5 font-semibold text-black shadow-[var(--shadow)]
transition hover:brightness-95 hover:-translate-y-[1px] md:col-span-6"
          >
            Apply filters
          </button>

          <p className="md:col-span-6 text-xs text-muted">
            Region filters offerings by <span className="font-mono">regionKey</span>. Price shown is the lowest
            in-stock offering (converted via FX if available). If no offering exists, price is hidden.
          </p>
        </form>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)] md:block">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-border">
              <th className="py-3 pr-4">Machine</th>
              <th className="py-3 pr-4">Algorithm</th>
              <th className="py-3 pr-4">Hashrate</th>
              <th className="py-3 pr-4">Power</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Lowest price</th>
              <th className="py-3 pr-4">Revenue/day</th>
              <th className="py-3 pr-4">Profit/day</th>
              <th className="py-3 pr-4">Best coin</th>
              <th className="py-3 pr-4">Updated</th>
            </tr>
          </thead>

          <tbody>
            {machines.map((m) => {
              const snap = m.profitabilitySnapshots[0] ?? null;

              const revenueUsd = snap ? toNumber(snap.revenueUsdPerDay) : null;

              const userElecUsdDay =
                revenueUsd == null
                  ? null
                  : computeElectricityUsdPerDay(m.powerW, electricity);

              const profit =
                revenueUsd == null || userElecUsdDay == null
                  ? null
                  : revenueUsd - userElecUsdDay;

              const lowest = getLowestPriceDisplay(m.vendorOfferings);

              const revenueDisplay =
                revenueUsd == null
                  ? "—"
                  : formatMoney(
                      convertUsdToCurrency(revenueUsd, currency, fxRates) ?? revenueUsd,
                      currency
                    );

              const profitDisplay =
                profit == null
                  ? "—"
                  : formatMoney(
                      convertUsdToCurrency(profit, currency, fxRates) ?? profit,
                      currency
                    );

              return (
                <tr key={m.id} className="border-b border-white/5">
                  <td className="py-3 pr-4">
                    <Link
                      className="font-semibold underline decoration-[rgb(var(--accent-yellow)/0.35)] hover:decoration-[rgb(var(--accent-yellow)/0.75)]"
                      href={`/machines/${m.slug}`}
                    >
                      {m.name}
                    </Link>
                    {m.manufacturer ? (
                      <div className="text-xs text-muted">{m.manufacturer}</div>
                    ) : null}
                  </td>

                  <td className="py-3 pr-4">{m.algorithm.name}</td>
                  <td className="py-3 pr-4">
                    {m.hashrate} {m.hashrateUnit}
                  </td>
                  <td className="py-3 pr-4">{m.powerW} W</td>
                  <td className="py-3 pr-4">{m.status}</td>

                  <td className="py-3 pr-4">
                    {lowest ? (
                      <span className="font-medium">
                        {formatMoney(lowest.amount, lowest.currency)}
                      </span>
                    ) : (
                      <span className="text-muted">No listings</span>
                    )}
                  </td>

                  <td className="py-3 pr-4">{revenueDisplay}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        profit != null && profit < 0
                          ? "text-[rgb(var(--accent-red))]"
                          : "text-emerald-600 dark:text-emerald-300"
                      }
                    >
                      {profitDisplay}
                    </span>
                  </td>

                  <td className="py-3 pr-4">
                    {snap?.bestCoin ? (
                      <span className="text-white/80">{snap.bestCoin.symbol}</span>
                    ) : (
                      <span className="text-white/40">—</span>
                    )}
                  </td>

                  <td className="py-3 pr-4 text-xs text-white/50">
                    {snap
                      ? snap.computedAt.toISOString().slice(0, 16).replace("T", " ")
                      : "—"}
                  </td>
                </tr>
              );
            })}

            {machines.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-white/60">
                  No machines found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {machines.map((m) => {
          const snap = m.profitabilitySnapshots[0] ?? null;

          const revenueUsd = snap ? toNumber(snap.revenueUsdPerDay) : null;

          const userElecUsdDay =
            revenueUsd == null
              ? null
              : computeElectricityUsdPerDay(m.powerW, electricity);

          const profit =
            revenueUsd == null || userElecUsdDay == null
              ? null
              : revenueUsd - userElecUsdDay;

          const lowest = getLowestPriceDisplay(m.vendorOfferings);

          const profitDisplay =
            profit == null
              ? "—"
              : formatMoney(
                  convertUsdToCurrency(profit, currency, fxRates) ?? profit,
                  currency
                );

          return (
            <div
              key={m.id}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)]
transition hover:-translate-y-[1px] hover:border-[rgb(var(--accent-yellow)/0.45)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[rgb(var(--accent-yellow)/0.75)]" />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/machines/${m.slug}`}
                    className="text-base font-semibold underline decoration-white/20"
                  >
                    {m.name}
                  </Link>
                  <div className="mt-1 text-xs text-white/60">
                    {m.algorithm.name} • {m.hashrate} {m.hashrateUnit} •{" "}
                    {m.powerW}W
                  </div>
                </div>
                <div className="text-xs text-muted">{m.status}</div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-border bg-bg p-3">
                  <div className="text-xs text-white/60">Lowest price</div>
                  <div className="mt-1 font-semibold">
                    {lowest ? (
                      formatMoney(lowest.amount, lowest.currency)
                    ) : (
                      <span className="text-white/40">No listings</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-bg p-3">
                  <div className="text-xs text-white/60">Profit/day</div>
                  <div
                    className={`mt-1 font-semibold ${
                      profit != null && profit < 0
                        ? "text-red-200"
                        : "text-emerald-200"
                    }`}
                  >
                    {profitDisplay}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-muted">
                Updated:{" "}
                {snap
                  ? snap.computedAt.toISOString().slice(0, 16).replace("T", " ")
                  : "—"}
              </div>
            </div>
          );
        })}

        {machines.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
            No machines found.
          </div>
        )}
      </div>
    </main>
  );
}
