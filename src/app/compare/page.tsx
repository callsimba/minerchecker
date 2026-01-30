import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { convertToUsd, convertUsdToCurrency, getLatestFxRates, toNumber } from "@/server/public";

export const dynamic = "force-dynamic";

const WHAT_IF_RATES = [0.05, 0.1, 0.15];

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

// ---------- Utils ----------
function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseIds(raw: string) {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNum(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildBackHref(
  sp: Record<string, string | string[] | undefined>,
  idsRaw: string
) {
  const p = new URLSearchParams();
  const keepKeys = ["currency", "region", "electricity"];
  for (const k of keepKeys) {
    const v = firstParam(sp[k]);
    if (v != null && v !== "") p.set(k, String(v));
  }
  
  // Restore the comparison state on homepage if IDs exist
  if (idsRaw) {
    p.set("compare", idsRaw);
  }

  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function money(amount: number, currency: string) {
  const cur = currency.toUpperCase();
  let fmt = fmtCache.get(cur);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    });
    fmtCache.set(cur, fmt);
  }
  return fmt.format(amount);
}

// ---------- Page ----------
export default async function ComparePage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  // ids come from tray link: /compare?ids=a,b,c
  // enforce max 5
  const idsRaw = String(firstParam(sp.ids) ?? "").trim();
  const ids = (idsRaw ? parseIds(idsRaw) : []).slice(0, 5);

  // require at least 2 to compare
  const hasEnough = ids.length >= 2;

  // keep consistent with profitability page defaults
  const currency = String(firstParam(sp.currency) ?? "USD").toUpperCase();
  const regionKey = String(firstParam(sp.region) ?? "GLOBAL").toUpperCase();
  const electricity = parseNum(String(firstParam(sp.electricity) ?? "0.10"), 0.1);

  const fxRates = await getLatestFxRates();

  function toDisplay(usd: number) {
    const converted = convertUsdToCurrency(usd, currency, fxRates);
    const value = converted ?? usd;
    return money(value, converted == null ? "USD" : currency);
  }

  const backHref = buildBackHref(sp, ids.join(","));

  if (!hasEnough) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-slate-200">
        <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-10">
          <div className="rounded-3xl border border-slate-800 bg-[#151a2a] p-8 text-center">
            <div className="text-5xl mb-3 opacity-60">🧮</div>
            <h1 className="text-2xl font-black text-white">Compare</h1>
            <p className="text-slate-400 mt-2">
              Select at least 2 miners to compare.
            </p>
            <Link
              href={backHref}
              className="inline-flex mt-6 bg-white text-black font-black px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors"
            >
              ← Back to Profitability
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const machines = await prisma.machine.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      hashrate: true,
      hashrateUnit: true,
      powerW: true,
      efficiency: true,
      efficiencyUnit: true,
      algorithm: { select: { name: true } },
      vendorOfferings: {
        where: {
          inStock: true,
          regionKey: regionKey === "GLOBAL" ? undefined : regionKey,
        },
        select: { price: true, currency: true },
      },
      profitabilitySnapshots: {
        orderBy: { computedAt: "desc" },
        take: 1,
        select: {
          computedAt: true,
          revenueUsdPerDay: true,
          bestCoin: { select: { symbol: true } },
        },
      },
    },
  });

  // preserve order from ids in URL
  const byId = new Map(machines.map((m) => [m.id, m]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof machines;

  function bestPriceUsd(offers: Array<{ price: any; currency: string }>) {
    let best: number | null = null;
    let count = 0;

    for (const off of offers) {
      const p = toNumber(off.price);
      if (p == null) continue;
      const usd = convertToUsd(p, off.currency, fxRates);
      if (usd == null) continue;
      count++;
      if (best == null || usd < best) best = usd;
    }

    return { best, count };
  }

  const rows = ordered.map((m) => {
    const snap = m.profitabilitySnapshots[0] ?? null;
    const revenueUsd = snap ? toNumber(snap.revenueUsdPerDay) : null;

    const dailyKwh = ((m.powerW ?? 0) / 1000) * 24;
    const elecUsd = dailyKwh * electricity;
    const profitUsd = revenueUsd != null ? revenueUsd - elecUsd : null;

    const beRate = revenueUsd != null && dailyKwh > 0 ? revenueUsd / dailyKwh : null;

    const { best, count } = bestPriceUsd(m.vendorOfferings);
    const roiDays = best != null && profitUsd != null && profitUsd > 0 ? best / profitUsd : null;

    const whatIf = WHAT_IF_RATES.map((rate) => {
      if (revenueUsd == null || dailyKwh <= 0) return { rate, profitUsd: null as number | null, display: "—" };
      const p = revenueUsd - dailyKwh * rate;
      return { rate, profitUsd: p, display: toDisplay(p) };
    });

    return {
      m,
      revenueUsd,
      profitUsd,
      beRate,
      bestPriceUsd: best,
      offerCount: count,
      roiDays,
      bestCoin: snap?.bestCoin?.symbol ?? null,
      revenueDisplay: revenueUsd != null ? toDisplay(revenueUsd) : "—",
      profitDisplay: profitUsd != null ? toDisplay(profitUsd) : "—",
      priceDisplay: best != null ? toDisplay(best) : "—",
      whatIf,
    };
  });

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 pb-16">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Compare</h1>
            <p className="text-sm text-slate-400 mt-1">
              {rows.length} miners • Region: <span className="font-mono">{regionKey}</span> • Currency:{" "}
              <span className="font-mono">{currency}</span> • Electricity:{" "}
              <span className="font-mono">${electricity.toFixed(2)}</span>/kWh
            </p>
          </div>

          <Link
            href={backHref}
            className="inline-flex bg-white text-black font-black px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors"
          >
            ← Back to Profitability
          </Link>
        </div>

        {/* Selected Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {rows.map((r) => (
            <div key={r.m.id} className="rounded-2xl border border-slate-800 bg-[#151a2a] p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[#0b0e14] border border-slate-800 overflow-hidden flex items-center justify-center">
                  {r.m.imageUrl ? (
                    <Image src={r.m.imageUrl} alt={r.m.name} width={48} height={48} className="object-contain" />
                  ) : (
                    <span className="opacity-40">🧊</span>
                  )}
                </div>
                <div className="min-w-0">
                  <Link href={`/machines/${r.m.slug}`} className="font-black text-white hover:text-orange-400 block truncate">
                    {r.m.name}
                  </Link>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {r.m.algorithm?.name ?? "—"}{" "}
                    {r.bestCoin ? <span className="ml-2 font-mono">{r.bestCoin}</span> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="bg-[#0b0e14] border border-slate-800 rounded-xl p-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Profit</div>
                  <div className={`text-sm font-mono font-bold ${r.profitUsd != null && r.profitUsd > 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {r.profitDisplay}
                  </div>
                </div>
                <div className="bg-[#0b0e14] border border-slate-800 rounded-xl p-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Best Price</div>
                  <div className="text-sm font-mono text-slate-200">{r.priceDisplay}</div>
                </div>
                <div className="bg-[#0b0e14] border border-slate-800 rounded-xl p-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">ROI</div>
                  <div className="text-sm font-mono text-slate-200">{r.roiDays != null ? `${Math.ceil(r.roiDays)}d` : "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Compare Table */}
        <div className="rounded-2xl border border-slate-800 bg-[#151a2a] overflow-hidden shadow-2xl">
          <div className="px-4 py-3 border-b border-white/5 bg-[#0b0e14]/50 flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">Side-by-side metrics</div>
            <div className="text-[10px] text-slate-500 font-mono">What-if: $0.05 / $0.10 / $0.15</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse">
              <thead>
                <tr className="bg-[#0b0e14] text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th className="px-4 py-3 text-left">Metric</th>
                  {rows.map((r) => (
                    <th key={r.m.id} className="px-4 py-3 text-left">
                      <span className="text-slate-300">{r.m.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5 text-sm">
                <tr>
                  <td className="px-4 py-3 text-xs text-slate-500 font-bold">Hashrate</td>
                  {rows.map((r) => (
                    <td key={r.m.id} className="px-4 py-3 font-mono text-slate-200">
                      {String(r.m.hashrate ?? "—")} <span className="text-slate-500">{r.m.hashrateUnit}</span>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-4 py-3 text-xs text-slate-500 font-bold">Power</td>
                  {rows.map((r) => (
                    <td key={r.m.id} className="px-4 py-3 font-mono text-slate-200">
                      {r.m.powerW ?? "—"} <span className="text-slate-500">W</span>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-4 py-3 text-xs text-slate-500 font-bold">Revenue / Day</td>
                  {rows.map((r) => (
                    <td key={r.m.id} className="px-4 py-3 font-mono text-slate-200">
                      {r.revenueDisplay}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-4 py-3 text-xs text-slate-500 font-bold">Net Profit / Day</td>
                  {rows.map((r) => (
                    <td
                      key={r.m.id}
                      className={`px-4 py-3 font-mono font-bold ${
                        r.profitUsd != null && r.profitUsd > 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {r.profitDisplay}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-4 py-3 text-xs text-slate-500 font-bold">Best Price</td>
                  {rows.map((r) => (
                    <td key={r.m.id} className="px-4 py-3 font-mono text-slate-200">
                      {r.priceDisplay}
                      {r.offerCount ? (
                        <div className="text-[10px] text-slate-500 mt-1">{r.offerCount} offers</div>
                      ) : null}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-4 py-3 text-xs text-slate-500 font-bold">ROI</td>
                  {rows.map((r) => (
                    <td key={r.m.id} className="px-4 py-3 font-mono text-slate-200">
                      {r.roiDays != null ? `${Math.ceil(r.roiDays)}d` : "—"}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-4 py-3 text-xs text-slate-500 font-bold">Break-even ($/kWh)</td>
                  {rows.map((r) => (
                    <td key={r.m.id} className="px-4 py-3 font-mono text-slate-200">
                      {r.beRate != null ? `$${r.beRate.toFixed(3)}` : "—"}
                    </td>
                  ))}
                </tr>

                {WHAT_IF_RATES.map((rate) => (
                  <tr key={rate}>
                    <td className="px-4 py-3 text-xs text-slate-500 font-bold">What-if Profit @ ${rate.toFixed(2)}</td>
                    {rows.map((r) => {
                      const w = r.whatIf.find((x) => x.rate === rate);
                      const val = w?.profitUsd ?? null;
                      return (
                        <td
                          key={r.m.id}
                          className={`px-4 py-3 font-mono font-bold ${
                            val == null ? "text-slate-500" : val > 0 ? "text-emerald-300" : "text-red-300"
                          }`}
                        >
                          {w?.display ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-white/5 text-[11px] text-slate-500">
            Tip: you can pass currency/region/electricity into this page too:{" "}
            <span className="font-mono">/compare?ids=...&amp;currency=EUR&amp;region=EU&amp;electricity=0.12</span>
          </div>
        </div>
      </div>
    </div>
  );
}