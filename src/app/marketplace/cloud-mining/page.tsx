import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import CloudMiningCalculator from "@/components/cloud-mining/cloud-mining-calculator";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cloud Mining • MinerChecker" };

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** * A sleek, glass-morphism card with optional color accent glows. */
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

export default function Page() {
  const quickLinks = [
    {
      title: "Browse ASIC miners",
      desc: "Compare hardware ROI vs electricity cost in your region.",
      href: "/",
      tone: "yellow",
    },
    {
      title: "Mining pools",
      desc: "Payout models, variance, and how to choose a pool.",
      href: "/miners/mining-pools",
      tone: "cyan",
    },
    {
      title: "Trusted vendors",
      desc: "Find verified vendors and in-stock offers (if available).",
      href: "/marketplace/trusted-vendors",
      tone: "purple",
    },
  ] as const;

  return (
    <PageShell
      title="Cloud Mining"
      subtitle="Understand cloud mining models, contract risks, and how to evaluate expected returns versus owning hardware."
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
                 Interactive Tool
               </div>
               
               <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                 Treat contracts like <br/>
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-400">financial instruments.</span>
               </h1>
               
               <p className="max-w-md text-lg text-zinc-400 leading-relaxed">
                 Cloud mining is convenient, but the math is often misunderstood. Model your <strong>net yield</strong> after maintenance, downtime, and difficulty growth.
               </p>

               <div className="flex flex-wrap gap-3 pt-2">
                 <Link href="/" className="rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-200 transition-colors">
                   Compare Hardware ROI
                 </Link>
                 <Link href="/miners/mining-pools" className="rounded-xl border border-white/10 bg-white/5 text-white px-5 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors">
                   Pool Guide
                 </Link>
               </div>
             </div>

             <div className="grid gap-3 lg:pl-10">
               {quickLinks.map((l) => (
                 <Link
                   key={l.href}
                   href={l.href}
                   className="group relative flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-x-1"
                 >
                   <div>
                     <div className="font-semibold text-white">{l.title}</div>
                     <div className="text-xs text-zinc-500">{l.desc}</div>
                   </div>
                   <div className="text-zinc-500 group-hover:text-white transition-colors">→</div>
                 </Link>
               ))}
             </div>
           </div>
        </section>

        {/* EDUCATIONAL GRID */}
        <section className="grid gap-6 md:grid-cols-3">
          <GlowCard className="md:col-span-2 p-6 md:p-8 flex flex-col justify-center" tone="purple">
            <h2 className="text-xl font-semibold text-white">Models & Mechanisms</h2>
            <p className="mt-2 text-zinc-400 max-w-xl">
              Providers market “hashrate”, but the real product is a bundle of fees, assumptions, and operational control.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { t: "Hashrate Contract", d: "Pay upfront for X TH/s. Risk: Fees + Diff Growth > Yield.", i: "📜" },
                { t: "Hosted Mining", d: "You own the hardware, they host it. Better transparency.", i: "🏭" },
                { t: "Revenue Share", d: "Split yields with operator. Hardest to audit.", i: "🤝" },
              ].map((c) => (
                <div key={c.t} className="rounded-xl bg-black/20 p-3 ring-1 ring-white/5">
                   <div className="mb-2 text-xl">{c.i}</div>
                   <div className="font-semibold text-white text-sm">{c.t}</div>
                   <div className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{c.d}</div>
                </div>
              ))}
            </div>
          </GlowCard>

          <GlowCard className="p-6 md:p-8" tone="yellow">
            <h2 className="text-xl font-semibold text-white mb-4">Red Flags 🚩</h2>
            <div className="space-y-3">
              {[
                "No clear maintenance fee breakdown",
                "No real-time hashrate proof",
                "High minimum withdrawals",
                "Aggressive “Guaranteed ROI” marketing",
              ].map((x) => (
                <div key={x} className="flex items-start gap-3 text-sm text-zinc-400">
                  <span className="text-yellow-500/50 mt-0.5">⚠️</span>
                  <span>{x}</span>
                </div>
              ))}
            </div>
          </GlowCard>
        </section>

        {/* CALCULATOR TOOL */}
        <CloudMiningCalculator />

        {/* FAQ SECTION */}
        <section className="rounded-3xl border border-white/5 bg-zinc-950 p-8">
           <h3 className="text-lg font-semibold text-white mb-6">Frequently Asked Questions</h3>
           <div className="grid gap-4 md:grid-cols-3">
             <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5">
               <div className="font-semibold text-zinc-200 mb-2">Why do contracts lose money?</div>
               <p className="text-sm text-zinc-500 leading-relaxed">
                 Because difficulty rises over time (diluting your share) and maintenance fees are fixed in USD. If revenue drops below fees, you get zero.
               </p>
             </div>
             <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5">
               <div className="font-semibold text-zinc-200 mb-2">When does cloud mining work?</div>
               <p className="text-sm text-zinc-500 leading-relaxed">
                 Rarely, but possible if the operator has incredibly cheap power and passes those savings on, or as a short-term hedge.
               </p>
             </div>
             <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5">
               <div className="font-semibold text-zinc-200 mb-2">The most important metric?</div>
               <p className="text-sm text-zinc-500 leading-relaxed">
                 <span className="text-white font-medium">Net revenue decline rate.</span> Don't look at today's profit. Look at the profit in Month 12 after 40% difficulty growth.
               </p>
             </div>
           </div>
        </section>

      </div>
    </PageShell>
  );
}