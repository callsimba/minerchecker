import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata = { title: "Learning Hub • MinerChecker" };

type HubLink = {
  title: string;
  desc: string;
  href: string;
  badge?: string;
  icon?: string;
  tone?: "cyan" | "purple" | "emerald";
};

type Card = {
  title: string;
  desc: string;
  bullets: string[];
  cta?: HubLink;
};

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** * Glass Card Component */
function GlowCard({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "cyan" | "purple" | "emerald" | "amber";
}) {
  const styles = {
    default: "border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60",
    cyan: "border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/30",
    purple: "border-purple-500/20 bg-purple-500/5 hover:border-purple-500/30",
    emerald: "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30",
    amber: "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 backdrop-blur-sm transition-all duration-300",
        styles[tone],
        className
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-zinc-400 max-w-3xl leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function ContentCard({ card, tone = "default" }: { card: Card; tone?: "default" | "cyan" | "purple" | "emerald" }) {
  return (
    <GlowCard tone={tone} className="flex flex-col h-full hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/20">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{card.title}</h3>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed min-h-[3rem]">{card.desc}</p>
      </div>
      
      <ul className="space-y-3 flex-1 mb-6">
        {card.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm text-zinc-300">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${tone === 'cyan' ? 'bg-cyan-400' : tone === 'purple' ? 'bg-purple-400' : 'bg-zinc-500'}`} />
            <span className="leading-relaxed opacity-90">{b}</span>
          </li>
        ))}
      </ul>

      {card.cta ? (
        <div className="mt-auto pt-4 border-t border-white/5">
          <Link
            href={card.cta.href}
            className="group flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
          >
            <div>
              <div className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                {card.cta.title}
              </div>
              <div className="text-xs text-zinc-500">{card.cta.desc}</div>
            </div>
            <span className="text-zinc-500 group-hover:text-white transition-colors">→</span>
          </Link>
        </div>
      ) : null}
    </GlowCard>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <GlowCard className="bg-zinc-900/60 border-zinc-800">
      <div className="flex items-center gap-3 mb-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-xl">✅</span>
        <div>
          <h3 className="text-lg font-bold text-white">Operator Checklist</h3>
          <p className="text-xs text-zinc-500">Pre-flight check for new deployments.</p>
        </div>
      </div>
      
      <div className="grid gap-3">
        {items.map((t, i) => (
          <label
            key={i}
            className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-black/20 hover:bg-black/40 transition-colors cursor-pointer group"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/20"
            />
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors leading-relaxed">
              {t}
            </span>
          </label>
        ))}
      </div>
    </GlowCard>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "What’s the single best metric when comparing ASIC miners?",
      a: "Efficiency (W per TH) plus purchase price. Hashrate matters, but efficiency determines how well you survive difficulty increases and price drops.",
    },
    {
      q: "Why does my profit drop even if the coin price didn’t change?",
      a: "Network difficulty/hashrate likely increased, your uptime dropped (heat), pool luck/payout method changed, or fees/rewards shifted.",
    },
    {
      q: "Should I mine and hold, or mine and sell?",
      a: "It depends on your cashflow. If power/hosting must be paid monthly, many operators sell enough to cover costs and optionally hold the rest.",
    },
    {
      q: "Is hosting always better than home mining?",
      a: "Not always. Hosting can reduce operational headaches but adds counterparty risk and recurring fees. Home mining can be cheaper if you have stable power + cooling + safety.",
    },
  ];

  return (
    <GlowCard className="bg-zinc-900/60 border-zinc-800">
      <div className="flex items-center gap-3 mb-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-xl">💬</span>
        <div>
          <h3 className="text-lg font-bold text-white">Common Questions</h3>
          <p className="text-xs text-zinc-500">Short answers to expensive problems.</p>
        </div>
      </div>

      <div className="space-y-3">
        {faqs.map((f, i) => (
          <details key={i} className="group rounded-2xl border border-white/5 bg-black/20 open:bg-black/40 transition-colors">
            <summary className="flex cursor-pointer items-center justify-between p-4 font-bold text-zinc-200 hover:text-white">
              <span className="text-sm">{f.q}</span>
              <span className="ml-4 text-zinc-500 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="px-4 pb-4 pt-0 text-sm text-zinc-400 leading-relaxed border-t border-white/5 mt-2 pt-3">
              {f.a}
            </div>
          </details>
        ))}
      </div>
    </GlowCard>
  );
}

// --- DATA ---

const quickLinks: HubLink[] = [
  {
    title: "Profitability Calculator",
    desc: "Model revenue vs electricity costs.",
    href: "/miners/profitability",
    badge: "Tool",
    icon: "🧮",
    tone: "cyan",
  },
  {
    title: "Event Calendar",
    desc: "Track network upgrades & conferences.",
    href: "/industry/mining-events",
    badge: "Live",
    icon: "🗓️",
    tone: "purple",
  },
  {
    title: "Vendor Directory",
    desc: "Find verified hardware sellers.",
    href: "/marketplace/trusted-vendors",
    badge: "Market",
    icon: "🛒",
    tone: "emerald",
  },
];

const fundamentals: Card[] = [
  {
    title: "ASIC Fundamentals",
    desc: "Buying mistakes happen when you focus on hashrate alone. Master the trifecta: Power, Efficiency, Price.",
    bullets: [
      "Hashrate (TH/s): Revenue potential.",
      "Power (W): Operating cost & infrastructure limit.",
      "Efficiency (J/TH): Bear market survival score.",
      "Algorithm: Defines which coin ecosystem you enter.",
    ],
  },
  {
    title: "Revenue Mechanics",
    desc: "Mining income is dynamic. It fights against network difficulty and halving cycles.",
    bullets: [
      "Coin Price: The volatile multiplier.",
      "Difficulty: The inevitable suppressor of yield.",
      "Fees: Variable bonuses based on chain activity.",
      "Luck: Pool variance (unless using PPS).",
    ],
  },
  {
    title: "ROI Reality Check",
    desc: "ROI calculators are snapshots, not promises. Real returns depend on difficulty growth.",
    bullets: [
      "Model difficulty rising 2-4% monthly.",
      "Include shipping, tax, and downtime.",
      "Factor in hardware resale value (depreciation).",
      "Stress test: What if price drops 30%?",
    ],
    cta: {
      title: "Run the Numbers",
      desc: "Use the advanced calculator",
      href: "/miners/profitability",
    },
  },
];

const operations: Card[] = [
  {
    title: "Power Infrastructure",
    desc: "Electrical safety is non-negotiable. Continuous load requires specific planning.",
    bullets: [
      "Use 80% rule for breaker capacity.",
      "PDUs must handle continuous amperage.",
      "Check voltage stability (208V-240V is ideal).",
      "Plan for heat exhaust (Watts In = Heat Out).",
    ],
  },
  {
    title: "Thermal Management",
    desc: "Heat kills ASICs. Proper airflow extends lifespan and maintains hashrate.",
    bullets: [
      "Separate Hot/Cold aisles if possible.",
      "Filter intake air (dust is an insulator).",
      "Monitor chip temps, not just ambient.",
      "Noise mitigation (75dB+ requires dampening).",
    ],
  },
  {
    title: "Pool Strategy",
    desc: "Don't just pick the default. Optimize for payout stability and latency.",
    bullets: [
      "PPS/FPPS: Guaranteed pay per share (Stable).",
      "PPLNS: Higher risk/reward (Variance).",
      "Ping matters: Lower latency = fewer stale shares.",
      "Verify payout thresholds and fees.",
    ],
  },
];

const risk: Card[] = [
  {
    title: "The 5 Core Risks",
    desc: "Mining is a financial product with hardware exposure. Know your enemies.",
    bullets: [
      "Market Risk: Coin price crash.",
      "Difficulty Risk: Network hash explosion.",
      "Op Risk: Fire, theft, failure.",
      "Counterparty Risk: Hosting/Pool insolvency.",
      "Regulatory Risk: Grid bans or taxes.",
    ],
  },
  {
    title: "Operational Security",
    desc: "You are your own bank. Secure your proceeds and your rig access.",
    bullets: [
      "Isolate miner network (VLAN).",
      "Change default SSH/Web passwords.",
      "Cold storage for HODL stacks.",
      "2FA on pool and exchange accounts.",
    ],
  },
  {
    title: "Financial Hygiene",
    desc: "Treat it like a business, even if it's a hobby. Records save you later.",
    bullets: [
      "Log purchase dates and cost basis.",
      "Track daily yield for tax events.",
      "Keep invoices for warranty claims.",
      "Monitor power costs vs revenue weekly.",
    ],
  },
];

const checklistItems = [
  "Validated electricity rate ($/kWh) from utility bill.",
  "Checked breaker capacity vs continuous load (80% rule).",
  "Modeled ROI with at least +2% monthly difficulty growth.",
  "Verified vendor reputation (or used escrow).",
  "Planned air intake/exhaust path.",
  "Network segmentation prepared (Guest/VLAN).",
  "Wallet backup secured offline (Seed phrase).",
  "Exit plan defined (Hold strategy vs Sell-to-cover).",
];

export default function Page() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 pb-24">
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden border-b border-white/5 bg-zinc-900/50 px-4 py-16 md:px-6 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-zinc-900/0 to-zinc-950/0 pointer-events-none" />
        
        <div className="relative mx-auto max-w-[1400px]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Knowledge Base
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6">
              The Mining <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Playbook.</span>
            </h1>
            
            <p className="text-lg text-zinc-400 leading-relaxed max-w-2xl">
              From ASIC fundamentals to advanced risk management. This hub aggregates the operational knowledge needed to turn hardware into a predictable business.
            </p>
          </div>

          {/* Quick Links Grid */}
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {quickLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-5 hover:bg-zinc-800/80 hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{l.icon}</span>
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-white/5", 
                    l.tone === 'cyan' ? 'text-cyan-400' : l.tone === 'purple' ? 'text-purple-400' : 'text-emerald-400'
                  )}>
                    {l.badge}
                  </span>
                </div>
                <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors">{l.title}</h3>
                <p className="text-xs text-zinc-500 mt-1">{l.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 mt-16 space-y-20">
        
        {/* SECTION: FUNDAMENTALS */}
        <section>
          <SectionHeader 
            title="1. Core Concepts" 
            subtitle="The economics of mining are often counter-intuitive. Understand these drivers before spending capital." 
          />
          <div className="grid gap-6 md:grid-cols-3">
            {fundamentals.map((c) => (
              <ContentCard key={c.title} card={c} tone="cyan" />
            ))}
          </div>
        </section>

        {/* SECTION: OPERATIONS */}
        <section>
          <SectionHeader 
            title="2. Operations Strategy" 
            subtitle="Uptime is the only thing you control. Optimize your physical and digital environment." 
          />
          <div className="grid gap-6 md:grid-cols-3">
            {operations.map((c) => (
              <ContentCard key={c.title} card={c} tone="purple" />
            ))}
          </div>
        </section>

        {/* SECTION: RISK */}
        <section>
          <SectionHeader 
            title="3. Risk & Security" 
            subtitle="Protecting your assets is as important as generating them." 
          />
          <div className="grid gap-6 md:grid-cols-3">
            {risk.map((c) => (
              <ContentCard key={c.title} card={c} tone="emerald" />
            ))}
          </div>
        </section>

        {/* SECTION: TOOLS */}
        <section className="grid gap-8 lg:grid-cols-2">
          <Checklist items={checklistItems} />
          <FAQ />
        </section>

        {/* FOOTER CTA */}
        <section className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 opacity-50" />
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl font-black text-white mb-4">Ready to calculate?</h2>
            <p className="text-zinc-400 mb-8">
              Take the theory and apply it to real numbers. Model your specific electricity rate against current network difficulty.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/miners/profitability"
                className="h-12 px-8 rounded-xl bg-white text-zinc-950 font-bold flex items-center hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
              >
                Launch Calculator
              </Link>
              <Link
                href="/vendors"
                className="h-12 px-8 rounded-xl border border-white/10 bg-white/5 text-white font-bold flex items-center hover:bg-white/10 transition-colors"
              >
                Browse Hardware
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}