import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { JSX } from "react";

export const metadata = { title: "FAQ & Knowledge Base • MinerChecker" };

type QA = { q: string; a: JSX.Element };

/** * Custom Styled Accordion Component */
function AccordionItem({ q, a }: QA) {
  return (
    <details className="group rounded-2xl border border-white/5 bg-zinc-900/40 open:bg-zinc-900/80 transition-all duration-300 hover:border-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-bold text-zinc-200 outline-none transition hover:text-white">
        <span className="leading-relaxed pr-6">{q}</span>
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/5 bg-black/20 text-zinc-500 transition-all group-hover:border-white/20 group-hover:text-white group-open:rotate-180 group-open:bg-cyan-500/10 group-open:text-cyan-400 group-open:border-cyan-500/30">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1L5 5L9 1" />
          </svg>
        </div>
      </summary>
      <div className="px-5 pb-6 pt-0 text-sm leading-7 text-zinc-400">
        <div className="mb-4 h-px w-full bg-gradient-to-r from-white/5 to-transparent" />
        <div className="prose prose-invert max-w-none text-sm">
          {a}
        </div>
      </div>
    </details>
  );
}

function SectionHeader({ title, icon, id }: { title: string; icon: string; id: string }) {
  return (
    <div id={id} className="flex items-center gap-3 pb-4 pt-8 scroll-mt-24">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/5 text-xl shadow-inner">
        {icon}
      </div>
      <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[11px] font-bold text-cyan-400 shadow-sm">
      {children}
    </span>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 decoration-cyan-500/30 transition-colors">
      {children}
    </a>
  );
}

export default function Page() {
  const sections: Array<{ id: string; icon: string; title: string; items: QA[] }> = [
    {
      id: "start",
      icon: "🚀",
      title: "Getting Started",
      items: [
        {
          q: "What is MinerChecker in one sentence?",
          a: (
            <p>
              MinerChecker is a hardware intelligence platform that helps you compare ASIC miners, estimate real-world profitability (factoring in electricity & difficulty), 
              and track live stock from verified vendors.
            </p>
          ),
        },
        {
          q: "Who is this platform for?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">Beginners</strong> learning the mechanics of mining economics.</li>
              <li><strong className="text-white">Home Miners</strong> optimizing for heat, noise, and residential power rates.</li>
              <li><strong className="text-white">Institutional Operators</strong> planning fleet upgrades and ROI cycles.</li>
            </ul>
          ),
        },
        {
          q: "What should I do first?",
          a: (
            <ol className="list-decimal pl-5 space-y-2">
              <li>Go to <Link href="/" className="text-cyan-400 hover:underline">ASIC Miners</Link> and filter by your preferred algorithm (e.g., SHA-256).</li>
              <li>Input your real electricity cost (e.g., <InlineCode>$0.12</InlineCode>) in the control bar.</li>
              <li>Sort by <strong>Efficiency</strong> to see which machines survive longest in a bear market.</li>
              <li>Check the <strong>Vendor</strong> tab to see who actually has stock.</li>
            </ol>
          ),
        },
      ],
    },
    {
      id: "profitability",
      icon: "💸",
      title: "Profitability & ROI",
      items: [
        {
          q: "What is a “profitability snapshot”?",
          a: (
            <p>
              A snapshot is a static calculation of revenue vs. cost at a specific moment in time. It uses the current coin price, 
              network difficulty, block rewards, and your specific electricity rate. It is <strong className="text-white">not a forecast</strong>—it's a current state assessment.
            </p>
          ),
        },
        {
          q: "Why does profitability change every day?",
          a: (
            <div className="space-y-2">
              <p>Five main variables move constantly:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-white">Coin Price:</strong> The most volatile factor.</li>
                <li><strong className="text-white">Network Difficulty:</strong> Adjusts roughly every 2 weeks (for BTC) based on total global hashrate.</li>
                <li><strong className="text-white">Transaction Fees:</strong> Spikes in network usage (like Ordinals on BTC) increase miner revenue temporarily.</li>
                <li><strong className="text-white">Pool Luck:</strong> Short-term variance in finding blocks.</li>
                <li><strong className="text-white">OpEx:</strong> Seasonal power rates or cooling costs.</li>
              </ul>
            </div>
          ),
        },
        {
          q: "What is the difference between Revenue and Profit?",
          a: (
            <div className="rounded-xl border border-white/5 bg-black/20 p-3 font-mono text-xs space-y-2">
              <div><span className="text-zinc-500">Revenue =</span> (Coins Mined) × (Coin Price)</div>
              <div><span className="text-zinc-500">Cost =</span> (Power kW) × (24h) × ($/kWh)</div>
              <div><span className="text-emerald-400">Profit =</span> Revenue − Cost</div>
            </div>
          ),
        },
        {
          q: "Why is the ROI (Payback Period) often inaccurate?",
          a: (
            <div className="space-y-3">
              <p>
                Standard ROI calculations assume <strong className="text-white">today's</strong> conditions last forever. They fail because:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Difficulty historically rises 2-4% per month, eating into yield.</li>
                <li>Halving events cut revenue by 50% instantly every ~4 years.</li>
                <li>Hardware depreciates in resale value over time.</li>
                <li>They ignore shipping, taxes, and infrastructure setup costs (CapEx).</li>
              </ul>
              <p className="text-xs text-zinc-500 italic">
                Tip: Always model a "bear scenario" where difficulty rises but price stays flat.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      id: "hardware",
      icon: "⚙️",
      title: "Hardware & Operations",
      items: [
        {
          q: "What does J/TH (Efficiency) mean?",
          a: (
            <p>
              Joules per Terahash. It measures how much energy is required to perform a specific amount of work. 
              <br/><br/>
              <strong className="text-white">Lower is better.</strong> A machine with <InlineCode>20 J/TH</InlineCode> is significantly more efficient than one with <InlineCode>30 J/TH</InlineCode>. 
              In high electricity cost environments, efficient machines stay profitable much longer.
            </p>
          ),
        },
        {
          q: "How often does an ASIC need maintenance?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">Dusting:</strong> Every 3-6 months using an air compressor (never a vacuum). Clogged heatsinks lead to chip failure.</li>
              <li><strong className="text-white">Fans:</strong> Check monthly for wobble or unusual noise. These are the first moving parts to fail.</li>
              <li><strong className="text-white">Repasting:</strong> Old thermal paste can dry out after 2-3 years, causing high delta temps between chips.</li>
            </ul>
          ),
        },
        {
          q: "Should I buy the newest generation or older cheap models?",
          a: (
            <div className="space-y-2">
              <p>It depends entirely on your <strong>Power Cost</strong>:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-emerald-400">High Power Cost ($0.08+):</strong> You MUST buy high-efficiency (new gen) miners. Older units will burn more cash than they mine.</li>
                <li><strong className="text-cyan-400">Low Power Cost ($0.04-):</strong> Older, cheaper units (like S19j Pro) offer faster ROI because the upfront cost is so low, and your power bill doesn't hurt as much.</li>
              </ul>
            </div>
          ),
        },
      ],
    },
    {
      id: "firmware",
      icon: "🧠",
      title: "Firmware & Optimization",
      items: [
        {
          q: "What is Autotuning firmware?",
          a: (
            <p>
              Stock firmware applies the same voltage to every chip. Third-party firmware (like <ExternalLink href="https://braiins.com">Braiins</ExternalLink> or <ExternalLink href="https://vnish.com">Vnish</ExternalLink>) 
              tunes the frequency and voltage of <i>individual chips</i>. This can improve efficiency (J/TH) by 10-20% or increase hashrate without extra power.
            </p>
          ),
        },
        {
          q: "Is installing custom firmware safe?",
          a: (
            <p>
              Generally yes, if downloaded from official sources. It typically voids the manufacturer warranty, so use it on units that are out of warranty. 
              Be aware of "dev fees" (usually 2-3%) that the firmware developer takes from your mining time.
            </p>
          ),
        },
        {
          q: "What is Immersion Cooling?",
          a: (
            <p>
              Submerging miners in dielectric (non-conductive) fluid. This removes fans (noise/dust), allows higher overclocking, and recovers heat efficiently for water heating. 
              However, it requires expensive tanks, pumps, and specialized maintenance.
            </p>
          ),
        },
      ],
    },
    {
      id: "hosting",
      icon: "🏢",
      title: "Hosting & Colocation",
      items: [
        {
          q: "Home Mining vs. Hosted Mining?",
          a: (
            <div className="grid grid-cols-1 gap-2">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="font-bold text-white mb-1">🏠 Home Mining</div>
                <div className="text-xs">Pros: Full control, no counterparty risk, KYC-free.</div>
                <div className="text-xs">Cons: Noise, heat, expensive residential power rates.</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="font-bold text-white mb-1">🏭 Hosted (Colo)</div>
                <div className="text-xs">Pros: Cheap industrial power ($0.06-0.08), maintenance included.</div>
                <div className="text-xs">Cons: Vendor lock-in, custody risk, potential bankruptcy of host.</div>
              </div>
            </div>
          ),
        },
        {
          q: "What is PUE in hosting?",
          a: (
            <p>
              <strong>Power Usage Effectiveness.</strong> It is the ratio of total facility energy to IT equipment energy. A PUE of 1.0 is perfect efficiency. 
              Hosting facilities with high PUE (1.2+) are wasting energy on cooling/overhead, which might be passed on to you in fees.
            </p>
          ),
        },
      ],
    },
    {
      id: "security",
      icon: "🛡️",
      title: "Security & Trust",
      items: [
        {
          q: "How do I verify a vendor is legitimate?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Check the <Link href="/marketplace/trusted-vendors" className="text-cyan-400 hover:underline">Trusted Vendors</Link> directory for verification badges.</li>
              <li>Avoid "too good to be true" prices on Telegram or anonymous sites.</li>
              <li>Ask for a video call showing the specific stock with a paper timestamp.</li>
              <li>Use credit cards or escrow services for the first purchase if possible.</li>
            </ul>
          ),
        },
        {
          q: "Should I mine to an exchange address?",
          a: (
            <p>
              <strong className="text-red-400">Not recommended.</strong> Mining payouts are small and frequent. Many exchanges block or lose small deposits, 
              change deposit addresses without warning, or freeze accounts. Mine to a hardware wallet or a dedicated hot wallet you control.
            </p>
          ),
        },
        {
          q: "What is a Seed Phrase?",
          a: (
            <p>
              Your 12 or 24-word master key. If you lose your hardware wallet, this phrase restores your funds. 
              <br/>
              <span className="text-red-400 font-bold block mt-2">NEVER type it into a computer, take a photo of it, or share it with support. Write it on paper/steel only.</span>
            </p>
          ),
        },
      ],
    },
  ];

  return (
    <PageShell
      title="Knowledge Base"
      subtitle="The operator's manual for profitable, secure, and efficient mining."
    >
      <div className="flex flex-col lg:flex-row gap-8 mt-8 pb-24">
        
        {/* Sticky Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 rounded-2xl border border-white/5 bg-zinc-900/50 p-4 backdrop-blur-xl">
            <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 px-2">
              Categories
            </div>
            <nav className="space-y-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
                >
                  <span className="opacity-50 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0">{s.icon}</span>
                  {s.title}
                </a>
              ))}
            </nav>
            <div className="mt-6 pt-6 border-t border-white/5 px-2">
              <div className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Pro Tip</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Use <kbd className="font-mono bg-white/10 rounded px-1 text-white border border-white/10">Ctrl + F</kbd> to search specific terms quickly.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-16">
          
          {/* Mobile Category Links */}
          <div className="lg:hidden grid grid-cols-2 gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-sm font-bold text-zinc-300 active:bg-zinc-800"
              >
                <span>{s.icon}</span> {s.title}
              </a>
            ))}
          </div>

          {sections.map((s) => (
            <section key={s.id}>
              <SectionHeader id={s.id} icon={s.icon} title={s.title} />
              <div className="space-y-4">
                {s.items.map((item, idx) => (
                  <AccordionItem key={idx} q={item.q} a={item.a} />
                ))}
              </div>
            </section>
          ))}

          {/* Footer CTA */}
          <section className="rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-zinc-900 to-black p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 opacity-50" />
            <div className="relative z-10 max-w-xl mx-auto">
              <h2 className="text-2xl font-black text-white mb-3">Still have questions?</h2>
              <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
                If you have a specific scenario regarding electricity rates or facility build-outs, 
                check our advanced guides or join the community.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/miners/profitability"
                  className="h-11 px-6 rounded-xl bg-white text-zinc-950 text-sm font-bold flex items-center hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
                >
                  Calculator Tool
                </Link>
                <Link
                  href="/marketplace/trusted-vendors"
                  className="h-11 px-6 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-bold flex items-center hover:bg-white/10 transition-colors"
                >
                  Hardware Directory
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </PageShell>
  );
}