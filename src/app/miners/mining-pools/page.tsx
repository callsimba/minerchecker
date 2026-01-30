import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import PoolExplorer from "@/components/mining-pools/pool-explorer";
import { MINING_POOLS } from "@/lib/mining-pools";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mining Pools • MinerChecker" };

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** * A sleek, glass-morphism card with optional color accent glows.
 */
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
    default: "text-muted",
    cyan: "text-cyan-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-4 transition-transform hover:scale-105">
      <div className={cn("text-2xl font-bold tracking-tight", colors[tone] || "text-fg")}>{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-muted/60">{label}</div>
    </div>
  );
}

function VarianceMeter() {
  const rows = [
    { k: "FPPS", stability: 92, variance: 10, tone: "cyan" as const, note: "Stable" },
    { k: "PPS", stability: 88, variance: 14, tone: "yellow" as const, note: "Predictable" },
    { k: "PPLNS", stability: 60, variance: 45, tone: "purple" as const, note: "Variable" },
    { k: "SOLO", stability: 20, variance: 90, tone: "default" as const, note: "Lottery" },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-fg">Payout Variance Meter</h3>
          <p className="text-sm text-muted">Stability vs. Volatility Visualizer</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-muted/80">
          <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Best Default</div>
          <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-purple-400" /> Advanced</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {rows.map((r) => {
           const colorClass = r.tone === 'cyan' ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' :
             r.tone === 'purple' ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' :
             r.tone === 'yellow' ? 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]' :
             'bg-zinc-500';
             
           return (
            <div key={r.k} className="group relative flex flex-col justify-end pt-4 min-h-[120px]">
              {/* Bar track */}
              <div className="absolute top-0 bottom-8 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-white/5">
                {/* Fill */}
                <div 
                  className={cn("absolute bottom-0 w-full rounded-full transition-all duration-500 group-hover:brightness-125", colorClass)}
                  style={{ height: `${r.stability}%` }}
                />
              </div>
              
              <div className="relative z-10 mt-4 text-center">
                <div className="text-xl font-bold text-fg">{r.k}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted opacity-70 group-hover:opacity-100 transition-opacity">{r.note}</div>
              </div>
            </div>
           )
        })}
      </div>
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
  const coinSymbol = String(firstParam(sp.coin) ?? "").trim().toUpperCase();

  const [algorithms, coins] = await Promise.all([
    prisma.algorithm.findMany({
      orderBy: { name: "asc" },
      select: { key: true, name: true },
    }),
    prisma.coin.findMany({
      orderBy: { symbol: "asc" },
      select: {
        symbol: true,
        name: true,
        algorithm: { select: { key: true, name: true } },
      },
      take: 500,
    }),
  ]);

  // quick server-side “directory stats”
  const allRegions = uniq(MINING_POOLS.flatMap((p) => p.regions ?? []));
  const allPayouts = uniq(MINING_POOLS.flatMap((p) => p.payoutMethods ?? []));
  const allCoins = uniq(MINING_POOLS.flatMap((p) => p.coins ?? []));

  const quickLinks = [
    { title: "Browse miners", desc: "Shortlist hardware", href: "/", tone: "yellow" as const },
    { title: "Efficiency", desc: "J/TH analytics", href: "/miners/efficiency", tone: "cyan" as const },
    { title: "Manufacturers", desc: "Reliability notes", href: "/miners/manufacturers", tone: "purple" as const },
  ];

  return (
    <PageShell
      title="Mining Pools"
      subtitle="The operator's directory for fees, payout schemes, and regional availability."
    >
      <div className="space-y-8 pb-20">
        
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900/50 p-8 md:p-12 shadow-2xl">
           {/* Background Mesh */}
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-zinc-900/0 to-zinc-950/0" />
           <div className="absolute top-0 right-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/3 rounded-full bg-indigo-500/20 blur-[100px]" />
           <div className="absolute bottom-0 left-0 h-[300px] w-[300px] translate-y-1/3 -translate-x-1/4 rounded-full bg-cyan-500/10 blur-[80px]" />

           <div className="relative z-10 grid gap-10 lg:grid-cols-2 lg:items-center">
             <div className="space-y-6">
               <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                 <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                 </span>
                 Live Directory
               </div>
               
               <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
                 Pool selection <br/>
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-400">demystified.</span>
               </h1>
               
               <p className="max-w-md text-lg text-zinc-400 leading-relaxed">
                 Don't guess. Filter by <span className="text-white font-medium">payout model</span> and <span className="text-white font-medium">region</span> to optimize your revenue stability.
               </p>

               <div className="flex flex-wrap gap-3 pt-2">
                 {quickLinks.map((l) => (
                   <Link key={l.href} href={l.href} className="group relative rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10 hover:border-white/20 transition-all">
                     <div className="text-sm font-semibold text-white">{l.title}</div>
                     <div className="text-[10px] text-zinc-500 group-hover:text-zinc-400">{l.desc}</div>
                   </Link>
                 ))}
               </div>
             </div>

             <div className="grid grid-cols-2 gap-3 md:gap-4 lg:pl-10">
               <StatPill label="Active Pools" value={String(MINING_POOLS.length)} tone="yellow" />
               <StatPill label="Coins" value={String(allCoins.length)} tone="cyan" />
               <StatPill label="Payout Models" value={String(allPayouts.length)} tone="purple" />
               <StatPill label="Regions" value={String(allRegions.length)} tone="default" />
             </div>
           </div>
        </section>

        {/* GUIDES GRID */}
        <section className="grid gap-4 md:grid-cols-3">
          <GlowCard className="md:col-span-2 p-6 md:p-8 flex flex-col justify-center" tone="cyan">
            <h3 className="text-xl font-semibold text-white">Selection Playbook</h3>
            <p className="mt-2 text-zinc-400 max-w-lg">
              Optimizing for lowest fee is often a mistake. Prioritize <strong>latency</strong> (to reduce stale shares) and <strong>payout stability</strong> first.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
               <span className="rounded-md bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 border border-cyan-500/20">Step 1: Region Match</span>
               <span className="rounded-md bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-300 border border-yellow-500/20">Step 2: Payout Model</span>
               <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 border border-white/10">Step 3: Fees</span>
            </div>
          </GlowCard>
          
          <div className="grid gap-4">
             <GlowCard className="p-5" tone="yellow">
               <div className="text-xs font-bold uppercase tracking-widest text-yellow-500 mb-1">Smooth Payouts</div>
               <div className="text-lg font-bold text-white">FPPS / PPS</div>
               <div className="mt-1 text-xs text-zinc-400">Best for consistent cashflow. The pool takes the variance risk.</div>
             </GlowCard>
             <GlowCard className="p-5" tone="purple">
               <div className="text-xs font-bold uppercase tracking-widest text-purple-500 mb-1">High Variance</div>
               <div className="text-lg font-bold text-white">PPLNS</div>
               <div className="mt-1 text-xs text-zinc-400">Pays more over long-term if you have high uptime. Judge over 30 days.</div>
             </GlowCard>
          </div>
        </section>

        {/* VARIANCE METER */}
        <VarianceMeter />

        {/* MAIN EXPLORER APP */}
        <PoolExplorer
          pools={MINING_POOLS}
          algorithms={algorithms}
          coins={coins.map((c) => ({
            symbol: c.symbol,
            name: c.name,
            algorithmKey: c.algorithm.key,
            algorithmName: c.algorithm.name,
          }))}
          initial={{ algorithmKey, coinSymbol }}
        />

        {/* FOOTER CHECKLIST */}
        <section className="rounded-3xl border border-white/5 bg-zinc-950 p-8">
           <h3 className="text-lg font-semibold text-white mb-6">Common Pitfalls</h3>
           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
             {[
              { icon: "🛰️", t: "High Latency", d: "Choosing a pool far away increases stale shares, wasting your electricity." },
              { icon: "📉", t: "Fee Blindness", d: "A 1% pool with 0% stales beats a 0% pool with 2% stales." },
              { icon: "⏳", t: "Min Payouts", d: "Small miners may get stuck for weeks if the minimum withdrawal is high." },
              { icon: "🫣", t: "Short-termism", d: "Don't judge PPLNS pools on a 24-hour window. Wait 7 days minimum." },
             ].map(i => (
               <div key={i.t} className="flex gap-4 items-start opacity-80 hover:opacity-100 transition-opacity">
                 <div className="text-2xl grayscale">{i.icon}</div>
                 <div>
                   <div className="font-semibold text-zinc-200 text-sm">{i.t}</div>
                   <div className="text-xs text-zinc-500 mt-1 leading-relaxed">{i.d}</div>
                 </div>
               </div>
             ))}
           </div>
        </section>
      </div>
    </PageShell>
  );
}