import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  convertToUsd,
  convertUsdToCurrency,
  formatMoney,
  getLatestFxRates,
  toNumber,
} from "@/server/public";
import { computeElectricityUsdPerDay } from "@/server/profitability/math";
import { MachineDetailControls } from "@/components/machine-detail-controls";

export const dynamic = "force-dynamic";

function parseNum(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

export default async function MachineDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const slug = params.slug;

  const currency = String(sp.currency ?? "USD").toUpperCase();
  const regionKey = String(sp.region ?? "GLOBAL").toUpperCase();
  const electricity = parseNum(String(sp.electricity ?? "0.10"), 0.10);

  const fxRates = await getLatestFxRates();

  const machine = await prisma.machine.findUnique({
    where: { slug },
    include: {
      algorithm: true,
      canMineCoins: { include: { coin: true } },
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
  });

  if (!machine) return notFound();

  const snap = machine.profitabilitySnapshots[0] ?? null;

  // Lowest offering (converted to USD for comparison)
  const offers = [...machine.vendorOfferings];
  const offersWithUsd = offers
    .map((o) => {
      const raw = toNumber(o.price);
      if (raw == null) return null;
      const usd = convertToUsd(raw, o.currency, fxRates);
      if (usd == null) return null;
      return { o, raw, usd };
    })
    .filter(Boolean) as { o: any; raw: number; usd: number }[];

  offersWithUsd.sort((a, b) => a.usd - b.usd);

  const lowest = offersWithUsd[0]?.usd ?? null;
  const lowestDisplay =
    lowest == null
      ? null
      : convertUsdToCurrency(lowest, currency, fxRates) ?? lowest;

  // Profitability display
  const revenueUsd = snap ? toNumber(snap.revenueUsdPerDay) : null;

  const electricityUsdPerDay = computeElectricityUsdPerDay(
    machine.powerW,
    electricity
  );

  const userElecUsdDay = revenueUsd == null ? null : electricityUsdPerDay;

  const profit =
    revenueUsd == null || userElecUsdDay == null ? null : revenueUsd - userElecUsdDay;

  const profitDisplay =
    profit == null
      ? "—"
      : formatMoney(
          convertUsdToCurrency(profit, currency, fxRates) ?? profit,
          currency
        );

  const revenueDisplay =
    revenueUsd == null
      ? "—"
      : formatMoney(
          convertUsdToCurrency(revenueUsd, currency, fxRates) ?? revenueUsd,
          currency
        );

  const electricityDisplay = formatMoney(
    convertUsdToCurrency(electricityUsdPerDay, currency, fxRates) ??
      electricityUsdPerDay,
    currency
  );

  return (
    <main className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-[rgb(var(--accent-yellow)/0.75)]" />

        <div className="text-xs text-muted">
          <Link
            href="/"
            className="underline decoration-[rgb(var(--accent-yellow)/0.25)] hover:decoration-[rgb(var(--accent-yellow)/0.6)]"
          >
            Home
          </Link>{" "}
          / <span className="text-fg/80">{machine.slug}</span>
        </div>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{machine.name}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {machine.manufacturer ? (
            <span className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-fg">
              🏭 {machine.manufacturer}
            </span>
          ) : null}

          <span className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-fg">
            🧠 {machine.algorithm.name}
          </span>
          <span className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-fg">
            ⛏️ {machine.hashrate} {machine.hashrateUnit}
          </span>
          <span className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-fg">
            ⚡ {machine.powerW}W
          </span>
          <span className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-fg">
            📦 {machine.status}
          </span>
        </div>

        <p className="mt-4 text-sm text-muted">
          Profit/day is calculated using your electricity rate (USD/kWh) and this
          machine’s power draw.
        </p>
      </header>

      {/* Region selector (currency + electricity are managed in the header) */}
      <MachineDetailControls />

      {/* Snapshot + price */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]">
          <div className="text-xs text-muted">Lowest price</div>
          <div className="mt-2 text-xl font-semibold">
            {lowestDisplay == null ? (
              <span className="text-muted">No listings</span>
            ) : (
              formatMoney(lowestDisplay, currency)
            )}
          </div>
          <div className="mt-2 text-xs text-muted">
            Manual vendor offerings (in-stock only) for{" "}
            <span className="font-mono">{regionKey}</span>.
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]">
          <div className="text-xs text-muted">Revenue/day</div>
          <div className="mt-2 text-xl font-semibold">{revenueDisplay}</div>
          <div className="mt-2 text-xs text-muted">
            Best coin: {snap?.bestCoin?.symbol ?? "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted">Profit/day</div>
              <div
                className={`mt-2 text-xl font-semibold ${
                  profit != null && profit < 0
                    ? "text-[rgb(var(--accent-red))]"
                    : "text-[rgb(var(--accent-yellow))]"
                }`}
              >
                {profitDisplay}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Elec/day</div>
              <div className="mt-2 text-sm font-semibold">{electricityDisplay}</div>
              <div className="text-xs text-muted">@ {electricity.toFixed(2)} $/kWh</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-muted">
            Updated:{" "}
            {snap
              ? snap.computedAt.toISOString().slice(0, 16).replace("T", " ")
              : "—"}
          </div>
        </div>
      </div>

      {/* Specs */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Specs</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Algorithm</div>
            <div className="mt-1 font-medium">{machine.algorithm.name}</div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Hashrate</div>
            <div className="mt-1 font-medium">
              {machine.hashrate} {machine.hashrateUnit}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Power</div>
            <div className="mt-1 font-medium">{machine.powerW} W</div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Efficiency</div>
            <div className="mt-1 font-medium">
              {machine.efficiency
                ? `${machine.efficiency} ${machine.efficiencyUnit ?? ""}`
                : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Release date</div>
            <div className="mt-1 font-medium">
              {machine.releaseDate
                ? machine.releaseDate.toISOString().slice(0, 10)
                : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Status</div>
            <div className="mt-1 font-medium">{machine.status}</div>
          </div>
        </div>

        <div className="mt-4 text-sm">
          <div className="text-xs text-muted">Mineable coins</div>
          <div className="mt-1">
            {machine.canMineCoins.length ? (
              <div className="flex flex-wrap gap-2">
                {machine.canMineCoins.map((mc) => (
                  <span
                    key={mc.id}
                    className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-fg"
                  >
                    {mc.coin.symbol}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Vendors selling this machine</h2>
        <p className="mt-1 text-xs text-muted">
          Prices are manual (admin-entered). Sorted by lowest price.
        </p>

        <div className="mt-4 space-y-3">
          {offersWithUsd.length === 0 ? (
            <div className="rounded-xl border border-border bg-bg p-5 text-muted">
              No in-stock listings for region{" "}
              <span className="font-mono">{regionKey}</span>.
            </div>
          ) : (
            offersWithUsd.map(({ o, usd }) => {
              const display = convertUsdToCurrency(usd, currency, fxRates) ?? usd;
              return (
                <div key={o.id} className="rounded-xl border border-border bg-bg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{o.vendor.name}</div>
                        {o.vendor.isVerified ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                            Verified
                          </span>
                        ) : (
                          <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted">
                            Unverified
                          </span>
                        )}
                        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted">
                          Trust: {o.vendor.trustLevel}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-muted">
                        Region: <span className="font-mono">{o.regionKey}</span>
                        {o.productUrl ? (
                          <>
                            {" "}
                            •{" "}
                            <a
                              className="underline decoration-[rgb(var(--accent-yellow)/0.25)] hover:decoration-[rgb(var(--accent-yellow)/0.6)]"
                              href={o.productUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Product page
                            </a>
                          </>
                        ) : null}
                        {o.vendor.websiteUrl ? (
                          <>
                            {" "}
                            •{" "}
                            <a
                              className="underline decoration-[rgb(var(--accent-yellow)/0.25)] hover:decoration-[rgb(var(--accent-yellow)/0.6)]"
                              href={o.vendor.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Visit vendor
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-muted">Price</div>
                      <div className="text-lg font-semibold">
                        {formatMoney(display, currency)}
                      </div>
                      <div className="text-xs text-muted">
                        ({o.currency} {o.price})
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
