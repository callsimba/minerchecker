// src/app/miners/efficiency/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import EfficiencyCharts from "@/components/efficiency/efficiency-charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Efficiency Analytics • MinerChecker" };

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

// ---------- utils ----------
function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normalizeToTh(hashrate: number, unit: string) {
  const u = (unit || "").toLowerCase();
  if (u.includes("ph")) return hashrate * 1000;
  if (u.includes("th")) return hashrate;
  if (u.includes("gh")) return hashrate / 1000;
  if (u.includes("mh")) return hashrate / 1_000_000;
  if (u.includes("kh")) return hashrate / 1_000_000_000;
  return null;
}

function normalizeEfficiencyToJPerTh(val: number, unit: string) {
  const u = (unit || "").toLowerCase().replace(/\s+/g, "");
  if (!Number.isFinite(val) || val <= 0) return null;

  if (u.includes("j/th")) return val;
  if (u.includes("j/gh")) return val * 1000;
  if (u.includes("w/th")) return val;
  if (u.includes("w/gh")) return val * 1000;

  return val;
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function buildHistogram(values: number[], binSize = 5) {
  if (!values.length) return [];
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const start = Math.floor(min / binSize) * binSize;
  const end = Math.ceil(max / binSize) * binSize;

  const bins = new Map<number, number>();
  for (let b = start; b <= end; b += binSize) bins.set(b, 0);

  for (const v of values) {
    const key = Math.floor(v / binSize) * binSize;
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }

  return Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([from, count]) => ({
      from,
      to: from + binSize,
      label: `${from}–${from + binSize}`,
      count,
    }));
}

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** * Stylized card component */
function GlowCard({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "cyan" | "purple" | "yellow";
}) {
  const accent =
    tone === "cyan"
      ? "from-cyan-500/10 via-cyan-500/5 to-transparent border-cyan-500/20 shadow-[0_0_30px_-10px_rgba(6,182,212,0.15)]"
      : tone === "purple"
      ? "from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20 shadow-[0_0_30px_-10px_rgba(168,85,247,0.15)]"
      : tone === "yellow"
      ? "from-yellow-500/10 via-yellow-500/5 to-transparent border-yellow-500/20 shadow-[0_0_30px_-10px_rgba(234,179,8,0.15)]"
      : "from-white/5 via-white/0 to-transparent border-white/10";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-gradient-to-br bg-card/40 backdrop-blur-md",
        accent,
        className
      )}
    >
      {children}
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "cyan" | "purple" | "yellow";
}) {
  const colors = {
    default: "text-zinc-400",
    cyan: "text-cyan-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-4 transition-transform hover:scale-105">
      <div className={cn("text-2xl font-bold tracking-tight", colors[tone] || "text-fg")}>{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</div>
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const algorithmKey = String(firstParam(sp.algorithm) ?? "").trim();

  const [algorithms, raw] = await Promise.all([
    prisma.algorithm.findMany({
      orderBy: { name: "asc" },
      select: { key: true, name: true },
    }),
    prisma.machine.findMany({
      where: algorithmKey ? { algorithm: { key: algorithmKey } } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        powerW: true,
        hashrate: true,
        hashrateUnit: true,
        efficiency: true,
        efficiencyUnit: true,
        algorithm: { select: { key: true, name: true } },
      },
      take: 2000,
    }),
  ]);

  const points = raw
    .map((m) => {
      const powerW = Number(m.powerW ?? 0);
      const hashrate = Number(m.hashrate ?? 0);
      const hashrateUnit = String(m.hashrateUnit ?? "");
      const th = normalizeToTh(hashrate, hashrateUnit);

      let effJTH: number | null = null;
      if (m.efficiency != null && m.efficiencyUnit) {
        effJTH = normalizeEfficiencyToJPerTh(Number(m.efficiency), String(m.efficiencyUnit));
      }
      if (effJTH == null && th != null && th > 0 && Number.isFinite(powerW) && powerW > 0) {
        effJTH = powerW / th;
      }
      if (effJTH == null || !Number.isFinite(effJTH) || effJTH <= 0) return null;

      return {
        id: m.id,
        name: m.name,
        slug: m.slug,
        algorithmKey: m.algorithm?.key ?? null,
        algorithmName: m.algorithm?.name ?? "—",
        efficiencyJTH: effJTH,
        powerW: Number.isFinite(powerW) ? powerW : null,
        ths: th,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      name: string;
      slug: string;
      algorithmKey: string | null;
      algorithmName: string;
      efficiencyJTH: number;
      powerW: number | null;
      ths: number | null;
    }>;

  const effSorted = points.map((p) => p.efficiencyJTH).sort((a, b) => a - b);
  const stats = {
    total: points.length,
    min: effSorted.length ? effSorted[0] : null,
    median: percentile(effSorted, 0.5),
    p90: percentile(effSorted, 0.9),
  };
  const histogram = buildHistogram(effSorted, 5);
  const top10 = [...points].sort((a, b) => a.efficiencyJTH - b.efficiencyJTH).slice(0, 10);

  return (
    <PageShell
      title="Efficiency Analytics"
      subtitle="Identify the most energy-efficient hardware. Lower J/TH means better margins during bear markets."
    >
      <div className="space-y-8 pb-20">
        
        {/* CONTROL BAR */}
        <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl backdrop-blur-xl">
          <form className="flex flex-col md:flex-row gap-4 md:items-end" method="get">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Filter Algorithm</label>
              <div className="relative group">
                <select
                  name="algorithm"
                  defaultValue={algorithmKey}
                  className="w-full h-12 appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-300 outline-none transition-all hover:bg-white/10 focus:border-cyan-500/50 focus:bg-white/10 cursor-pointer"
                >
                  <option value="" className="bg-zinc-900 text-zinc-300">All Algorithms</option>
                  {algorithms.map((a) => (
                    <option key={a.key} value={a.key} className="bg-zinc-900 text-zinc-300">
                      {a.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="h-12 px-6 rounded-xl bg-cyan-500 text-black text-sm font-bold shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-all hover:-translate-y-0.5">
                Update View
              </button>
              <Link
                href="/miners/efficiency"
                className="h-12 w-12 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
                title="Reset Filters"
              >
                ↺
              </Link>
            </div>
          </form>

          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
             <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/10 text-[10px] text-cyan-400">i</span>
             <span>Filter by algorithm to see relevant comparisons. Bitcoin miners (SHA-256) shouldn't be compared to KAS/LTC miners.</span>
          </div>
        </section>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatPill label="Miners Analyzed" value={String(stats.total)} tone="default" />
          <StatPill label="Best (Min J/TH)" value={stats.min != null ? stats.min.toFixed(1) : "—"} tone="cyan" />
          <StatPill label="Median J/TH" value={stats.median != null ? stats.median.toFixed(1) : "—"} tone="purple" />
          <StatPill label="Worst (P90)" value={stats.p90 != null ? stats.p90.toFixed(1) : "—"} tone="yellow" />
        </div>

        {/* CHARTS SECTION */}
        <EfficiencyCharts histogram={histogram} points={points} stats={stats} />

        {/* TOP 10 RANKING */}
        <GlowCard className="bg-zinc-900/40" tone="cyan">
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <div>
               <h3 className="text-lg font-bold text-white">Efficiency Leaderboard</h3>
               <p className="text-xs text-zinc-500 mt-1">Top 10 models with lowest energy consumption per hashrate (J/TH).</p>
            </div>
            <div className="hidden md:block text-[10px] font-mono text-zinc-500 uppercase">Sorted by J/TH Ascending</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-white/[0.02]">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Model</th>
                  <th className="px-6 py-4 font-medium">Algorithm</th>
                  <th className="px-6 py-4 font-medium text-right">Efficiency</th>
                  <th className="px-6 py-4 font-medium text-right">Power</th>
                  <th className="px-6 py-4 font-medium text-right">Hashrate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {top10.map((m, idx) => (
                  <tr key={m.id} className="group hover:bg-white/[0.04] transition-colors">
                    <td className="px-6 py-4 font-mono text-zinc-500">#{idx + 1}</td>
                    <td className="px-6 py-4 font-medium text-white group-hover:text-cyan-400 transition-colors">
                      <Link href={`/machines/${m.slug}`}>{m.name}</Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400">
                        {m.algorithmName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-cyan-300">
                      {m.efficiencyJTH.toFixed(1)} <span className="text-[10px] text-cyan-300/50 font-normal">J/TH</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-zinc-300">
                      {m.powerW != null ? Math.round(m.powerW) : "—"} <span className="text-[10px] text-zinc-600">W</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-zinc-300">
                      {m.ths != null ? m.ths.toFixed(1) : "—"} <span className="text-[10px] text-zinc-600">TH/s</span>
                    </td>
                  </tr>
                ))}
                {!top10.length && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500 italic">No data available for this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlowCard>

      </div>
    </PageShell>
  );
}