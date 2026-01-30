import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata = { title: "Crypto Glossary • MinerChecker" };

type Term = {
  term: string;
  aka?: string;
  category:
    | "Mining basics"
    | "Hardware & performance"
    | "Pools & payouts"
    | "Network & protocol"
    | "Markets & economics"
    | "Security";
  definition: string;
  whyItMatters?: string;
  example?: string;
  related?: string[];
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** * Clean Card for Terms */
function TermCard({ t }: { t: Term }) {
  const id = slugify(t.term);
  return (
    <article
      id={id}
      className="scroll-mt-32 rounded-3xl border border-white/5 bg-zinc-900/40 p-6 backdrop-blur-sm transition-all hover:bg-zinc-900/60 hover:border-white/10 group"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-black text-white tracking-tight group-hover:text-cyan-400 transition-colors">
              {t.term}
            </h3>
            {t.aka && (
              <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border border-white/5">
                AKA: {t.aka}
              </span>
            )}
          </div>
        </div>

        <a
          href={`#${id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-zinc-500 hover:text-white"
          title="Link to definition"
        >
          #
        </a>
      </div>

      <p className="mt-4 text-base text-zinc-300 leading-relaxed max-w-3xl">
        {t.definition}
      </p>

      {(t.whyItMatters || t.example || (t.related && t.related.length)) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {t.whyItMatters && (
            <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-emerald-400 text-xs">💡</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                  Why it matters
                </span>
              </div>
              <div className="text-sm text-zinc-300 leading-relaxed">{t.whyItMatters}</div>
            </div>
          )}

          {t.example && (
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Example
              </div>
              <div className="text-sm text-zinc-400 leading-relaxed italic">"{t.example}"</div>
            </div>
          )}

          {t.related?.length ? (
            <div className="lg:col-span-2 pt-2 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mr-1">
                Related:
              </span>
              {t.related.map((r) => (
                <a
                  key={r}
                  href={`#${slugify(r)}`}
                  className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-colors"
                >
                  {r}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}

const TERMS: Term[] = [
  // Mining basics
  {
    term: "Hashrate",
    category: "Mining basics",
    definition: "The speed at which a miner performs hashing attempts. Higher hashrate generally means more chances to find valid blocks or shares.",
    whyItMatters: "Hashrate is the primary driver of revenue in proof-of-work mining (all else equal).",
    example: "A 200 TH/s Bitcoin miner performs ~200 trillion hashes per second.",
    related: ["Difficulty", "Share", "Proof of Work (PoW)"],
  },
  {
    term: "Difficulty",
    category: "Mining basics",
    definition: "A network setting that adjusts how hard it is to find a valid block. As total network hashrate rises, difficulty tends to rise (and vice versa).",
    whyItMatters: "Your expected earnings depend on your hashrate relative to the network after difficulty adjustments.",
    related: ["Hashrate", "Block Reward", "Network Hashrate"],
  },
  {
    term: "Proof of Work (PoW)",
    aka: "PoW",
    category: "Mining basics",
    definition: "A consensus mechanism where miners use computation to propose blocks. The chain with the most accumulated work is treated as canonical.",
    whyItMatters: "PoW is what makes ASIC mining possible and defines the competition dynamics (hashrate vs difficulty).",
    related: ["Block", "Difficulty", "Nonce"],
  },
  {
    term: "Block",
    category: "Mining basics",
    definition: "A batch of transactions added to the blockchain. In PoW, miners compete to produce a valid block header under the difficulty target.",
    related: ["Block Reward", "Transaction Fee", "Confirmations"],
  },
  {
    term: "Block Reward",
    category: "Mining basics",
    definition: "The reward paid to the miner/pool that finds a block, usually made of a protocol subsidy + transaction fees (network dependent).",
    whyItMatters: "When block subsidy drops (e.g., halving), efficient miners and cheaper power become more important.",
    related: ["Halving", "Transaction Fee", "Subsidy"],
  },
  {
    term: "Transaction Fee",
    category: "Mining basics",
    definition: "A fee paid by users to have transactions included in blocks. Fees can be a significant portion of miner revenue during high demand.",
    related: ["Mempool", "Block", "Block Reward"],
  },
  {
    term: "Mempool",
    category: "Mining basics",
    definition: "The set of unconfirmed transactions waiting to be included in a block. Congestion often drives higher fees.",
    related: ["Transaction Fee", "Confirmations"],
  },
  {
    term: "Confirmations",
    category: "Network & protocol",
    definition: "The number of blocks added after a transaction’s block. More confirmations typically means higher finality/settlement confidence.",
    example: "A BTC transaction with 6 confirmations has 6 blocks built on top of it.",
    related: ["Block", "Reorg", "Finality"],
  },

  // Hardware & performance
  {
    term: "ASIC",
    aka: "Application-Specific Integrated Circuit",
    category: "Hardware & performance",
    definition: "A specialized chip designed to mine a specific algorithm extremely efficiently compared to general hardware.",
    whyItMatters: "ASIC efficiency often determines who survives when difficulty rises or rewards drop.",
    related: ["Algorithm", "Efficiency (J/TH)", "Hashrate"],
  },
  {
    term: "Algorithm",
    category: "Hardware & performance",
    definition: "The hashing function a PoW network uses (e.g., SHA-256 for Bitcoin). Miners must support the algorithm to mine that network.",
    related: ["ASIC", "Coin", "Fork"],
  },
  {
    term: "Power Draw",
    category: "Hardware & performance",
    definition: "How much electrical power a miner consumes while operating, usually measured in watts (W).",
    whyItMatters: "Power cost is the biggest operating expense for most miners.",
    example: "A miner drawing 3,000W uses 3 kWh per hour.",
    related: ["Electricity Cost", "Efficiency (J/TH)"],
  },
  {
    term: "Efficiency (J/TH)",
    category: "Hardware & performance",
    definition: "Energy per unit of hashrate (joules per terahash, J/TH). Lower is better.",
    whyItMatters: "At the same electricity price, more efficient miners have lower operating cost per TH.",
    example: "25 J/TH is generally better than 35 J/TH (uses less power per TH).",
    related: ["Power Draw", "Hashrate", "Breakeven"],
  },
  {
    term: "Undervolting",
    category: "Hardware & performance",
    definition: "Reducing voltage/power target to improve efficiency, often at the cost of some hashrate. Done via firmware settings or control boards.",
    whyItMatters: "Can improve profitability when power is expensive or difficulty is high.",
    related: ["Efficiency (J/TH)", "Firmware", "Thermal Throttling"],
  },
  {
    term: "Overclocking",
    category: "Hardware & performance",
    definition: "Pushing a miner beyond default settings to increase hashrate, usually increasing power draw and heat.",
    whyItMatters: "Can raise revenue but may reduce hardware lifespan or cause instability.",
    related: ["Thermal Throttling", "Power Draw", "Firmware"],
  },
  {
    term: "Thermal Throttling",
    category: "Hardware & performance",
    definition: "Automatic performance reduction when a miner runs too hot to prevent damage.",
    whyItMatters: "A miner can look profitable on paper but underperform in a hot/poorly ventilated environment.",
    related: ["Cooling", "Power Draw"],
  },
  {
    term: "Cooling",
    category: "Hardware & performance",
    definition: "Systems that remove heat: air (fans/ducting), immersion (dielectric fluid), or hydro. Proper cooling sustains hashrate and reduces downtime.",
    related: ["Thermal Throttling", "Uptime"],
  },
  {
    term: "Uptime",
    category: "Hardware & performance",
    definition: "The percent of time a miner is successfully hashing. Downtime reduces earnings directly.",
    whyItMatters: "Even a 5% uptime loss is a 5% revenue loss before costs.",
    related: ["Pool", "Reject Rate", "Stale Shares"],
  },

  // Pools & payouts
  {
    term: "Mining Pool",
    category: "Pools & payouts",
    definition: "A service that aggregates hashrate from many miners and shares rewards proportionally, smoothing payout variance.",
    whyItMatters: "Solo mining is extremely volatile for most miners; pools provide steadier payouts.",
    related: ["Share", "Payout Method", "Luck"],
  },
  {
    term: "Share",
    category: "Pools & payouts",
    definition: "A proof from your miner that it performed work. Shares are easier-to-find “mini targets” used to measure contribution in a pool.",
    related: ["Difficulty", "Reject Rate", "Stale Shares"],
  },
  {
    term: "Reject Rate",
    category: "Pools & payouts",
    definition: "The fraction of submitted shares that the pool rejects (invalid, stale, or misformatted). Lower is better.",
    whyItMatters: "High rejects can indicate network latency, unstable overclocks, or configuration issues.",
    related: ["Stale Shares", "Latency", "Uptime"],
  },
  {
    term: "Stale Shares",
    category: "Pools & payouts",
    definition: "Shares submitted after the pool has moved to a new block template (often due to latency). These usually earn less or nothing.",
    related: ["Reject Rate", "Latency", "Orphan"],
  },
  {
    term: "PPS",
    aka: "Pay Per Share",
    category: "Pools & payouts",
    definition: "A payout method where the pool pays a fixed amount per valid share, transferring variance risk to the pool (often higher fees).",
    whyItMatters: "More predictable income, useful for cashflow planning.",
    related: ["FPPS", "PPLNS", "Pool Fee"],
  },
  {
    term: "FPPS",
    aka: "Full Pay Per Share",
    category: "Pools & payouts",
    definition: "Like PPS, but also includes an estimate/portion of transaction fees in the payout calculation.",
    related: ["PPS", "Transaction Fee", "Pool Fee"],
  },
  {
    term: "PPLNS",
    aka: "Pay Per Last N Shares",
    category: "Pools & payouts",
    definition: "A payout method that pays based on contribution over the last N shares. It can be higher variance but often lower pool fees.",
    whyItMatters: "Better aligned with long-term steady miners; can punish frequent switching.",
    related: ["PPS", "Pool Hopping", "Luck"],
  },
  {
    term: "Pool Fee",
    category: "Pools & payouts",
    definition: "The percentage the pool charges from rewards, often varying by payout method and included services.",
    related: ["PPS", "PPLNS", "Uptime"],
  },
  {
    term: "Luck",
    category: "Pools & payouts",
    definition: "How quickly a pool finds blocks relative to statistical expectation. In the short term, pools can be “lucky” or “unlucky.”",
    whyItMatters: "Short-term luck affects earnings, especially under PPLNS-like methods.",
    related: ["Variance", "Payout Method"],
  },
  {
    term: "Variance",
    category: "Pools & payouts",
    definition: "The natural randomness of block discovery. Pools reduce variance for miners by distributing reward over many participants.",
    related: ["Luck", "Solo Mining", "Payout Method"],
  },

  // Network & protocol
  {
    term: "Nonce",
    category: "Network & protocol",
    definition: "A value miners vary in the block header to produce different hashes while searching for a valid block under the difficulty target.",
    related: ["Proof of Work (PoW)", "Difficulty", "Block"],
  },
  {
    term: "Orphan Block",
    aka: "Stale block",
    category: "Network & protocol",
    definition: "A valid block that does not become part of the main chain (often because another competing block was accepted first).",
    whyItMatters: "Orphans reduce realized rewards for the miner/pool that found them.",
    related: ["Stale Shares", "Reorg", "Confirmations"],
  },
  {
    term: "Reorg",
    aka: "Chain reorganization",
    category: "Network & protocol",
    definition: "When a blockchain replaces a recent set of blocks with an alternative chain that has more accumulated work (PoW).",
    whyItMatters: "Reorgs can affect payouts, confirmations, and in rare cases security assumptions.",
    related: ["Confirmations", "Finality", "51% Attack"],
  },
  {
    term: "Finality",
    category: "Network & protocol",
    definition: "How irreversible a transaction is considered. In PoW, finality is probabilistic and increases with confirmations.",
    related: ["Confirmations", "Reorg"],
  },
  {
    term: "Halving",
    category: "Network & protocol",
    definition: "A scheduled reduction in block subsidy that occurs at fixed block intervals on some networks (e.g., Bitcoin).",
    whyItMatters: "Reduces miner revenue from subsidy; pushes miners to optimize efficiency and costs.",
    related: ["Block Reward", "Subsidy", "Difficulty"],
  },
  {
    term: "Fork",
    category: "Network & protocol",
    definition: "A change to protocol rules. A soft fork tightens rules; a hard fork changes rules in a way that can create chain splits if nodes don’t upgrade.",
    related: ["Algorithm", "Consensus", "Reorg"],
  },
  {
    term: "51% Attack",
    category: "Network & protocol",
    definition: "When a single entity controls a majority of network hashrate (or equivalent power) and can attempt reorgs, double-spends, or censorship.",
    whyItMatters: "Affects chain security and exchange confirmation policies.",
    related: ["Reorg", "Confirmations", "Network Hashrate"],
  },
  {
    term: "Network Hashrate",
    category: "Network & protocol",
    definition: "The total hashrate securing a PoW network. Typically inferred from blocks and difficulty.",
    related: ["Difficulty", "Hashrate", "51% Attack"],
  },

  // Markets & economics
  {
    term: "Revenue (per day)",
    category: "Markets & economics",
    definition: "Gross earnings from mining before costs (electricity, fees, downtime). In MinerChecker, this is typically modeled in USD/day.",
    related: ["Profit (per day)", "Electricity Cost", "Pool Fee"],
  },
  {
    term: "Electricity Cost",
    category: "Markets & economics",
    definition: "Your effective cost per kWh (including tariffs, delivery charges, and sometimes generator fuel if applicable).",
    whyItMatters: "Small differences in $/kWh can make or break profitability at scale.",
    example: "At $0.10/kWh, a 3,000W miner costs ~$7.20/day in power (3 kW × 24h × $0.10).",
    related: ["Power Draw", "Breakeven", "Profit (per day)"],
  },
  {
    term: "Profit (per day)",
    category: "Markets & economics",
    definition: "Net earnings after subtracting operating costs (primarily electricity and sometimes pool fees).",
    related: ["Revenue (per day)", "Electricity Cost", "Breakeven"],
  },
  {
    term: "Breakeven",
    category: "Markets & economics",
    definition: "The point where mining revenue equals costs (electricity + operational overhead). Below breakeven, you are mining at a loss.",
    related: ["Electricity Cost", "Profit (per day)", "ROI"],
  },
  {
    term: "ROI",
    aka: "Return on Investment",
    category: "Markets & economics",
    definition: "How long it takes to recover your upfront miner + infrastructure cost from net profits. Often quoted as “ROI days.”",
    whyItMatters: "Useful for comparing purchases, but sensitive to coin price, difficulty, fees, and uptime.",
    related: ["CapEx", "OpEx", "Payback Period"],
  },
  {
    term: "CapEx",
    aka: "Capital Expenditure",
    category: "Markets & economics",
    definition: "Upfront costs: miners, electrical work, racks, fans, immersion tanks, shipping, import duties.",
    related: ["OpEx", "ROI"],
  },
  {
    term: "OpEx",
    aka: "Operating Expenditure",
    category: "Markets & economics",
    definition: "Ongoing costs: power, hosting, labor, repairs, pool fees, internet, cooling consumables.",
    related: ["Electricity Cost", "Uptime", "Pool Fee"],
  },
  {
    term: "Slippage",
    category: "Markets & economics",
    definition: "The difference between expected and actual execution price when buying/selling mined coins (or hedges), especially in low-liquidity markets.",
    related: ["Liquidity", "Hedging"],
  },
  {
    term: "Liquidity",
    category: "Markets & economics",
    definition: "How easily an asset can be bought/sold without moving the price. Higher liquidity reduces slippage risk.",
    related: ["Slippage", "Exchange"],
  },
  {
    term: "Hedging",
    category: "Markets & economics",
    definition: "Risk management strategies that reduce exposure to coin price volatility (e.g., selling a portion regularly, futures, options).",
    whyItMatters: "Miners often have fixed costs; hedging can stabilize cashflow.",
    related: ["Volatility", "Slippage"],
  },
  {
    term: "Volatility",
    category: "Markets & economics",
    definition: "How much price moves over time. Mining profitability can swing rapidly with volatility.",
    related: ["Hedging", "ROI"],
  },

  // Security
  {
    term: "Wallet",
    category: "Security",
    definition: "A system for controlling private keys and addresses. Wallets can be software, hardware, or multisig setups.",
    related: ["Private Key", "Seed Phrase", "Address"],
  },
  {
    term: "Private Key",
    category: "Security",
    definition: "A secret value that proves ownership of funds. Anyone with the private key can spend the funds—protect it.",
    whyItMatters: "Mining payouts go to addresses controlled by your keys; key loss = fund loss.",
    related: ["Seed Phrase", "Hardware Wallet", "Multisig"],
  },
  {
    term: "Seed Phrase",
    aka: "Recovery phrase / mnemonic",
    category: "Security",
    definition: "A human-readable list of words that can recreate a wallet’s private keys. It must be kept offline and secret.",
    whyItMatters: "If someone gets the full seed phrase, they can take your funds.",
    related: ["Private Key", "Hardware Wallet"],
  },
  {
    term: "Address",
    category: "Security",
    definition: "A public identifier where funds can be received (like an account number). Addresses are safe to share; private keys are not.",
    related: ["Wallet", "Private Key"],
  },
  {
    term: "Multisig",
    aka: "Multi-signature",
    category: "Security",
    definition: "A wallet setup that requires multiple approvals/keys to spend funds (e.g., 2-of-3).",
    whyItMatters: "Reduces single-point-of-failure risk for treasury and pool payout wallets.",
    related: ["Private Key", "Hardware Wallet"],
  },
  {
    term: "Hardware Wallet",
    category: "Security",
    definition: "A dedicated device designed to store private keys securely and sign transactions offline.",
    related: ["Seed Phrase", "Private Key"],
  },
  {
    term: "Phishing",
    category: "Security",
    definition: "Tricking users into giving up credentials, API keys, or seed phrases via fake websites/messages.",
    whyItMatters: "Mining dashboards, exchanges, and pool logins are common phishing targets.",
    related: ["2FA", "API Key"],
  },
  {
    term: "2FA",
    aka: "Two-factor authentication",
    category: "Security",
    definition: "An extra verification step (authenticator app, hardware key) beyond a password.",
    whyItMatters: "Strongly recommended for exchanges and pool accounts that control payouts.",
    related: ["Phishing"],
  },
  {
    term: "API Key",
    category: "Security",
    definition: "A credential used by apps to access services (exchanges, pools, price feeds). Permissions should be minimal and rotated if exposed.",
    related: ["Phishing", "Least Privilege"],
  },
  {
    term: "Least Privilege",
    category: "Security",
    definition: "Grant only the permissions necessary to do the job. For mining, avoid giving withdrawal permissions to read-only integrations.",
    related: ["API Key", "2FA"],
  },
];

const CATEGORIES: Array<Term["category"]> = [
  "Mining basics",
  "Hardware & performance",
  "Pools & payouts",
  "Network & protocol",
  "Markets & economics",
  "Security",
];

export default function Page() {
  const grouped = CATEGORIES.map((cat) => ({
    cat,
    terms: TERMS.filter((t) => t.category === cat).sort((a, b) => a.term.localeCompare(b.term)),
  }));

  return (
    <PageShell
      title="Mining Glossary"
      subtitle="The technical dictionary for operators. Precise definitions for hardware, protocol, and economic terms."
    >
      <div className="flex flex-col lg:flex-row gap-8 mt-12 pb-20">
        
        {/* Sticky Sidebar Navigation (Desktop) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 space-y-8">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">Table of Contents</div>
              <nav className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <a
                    key={cat}
                    href={`#${slugify(cat)}`}
                    className="block text-sm font-medium text-zinc-400 hover:text-white hover:translate-x-1 transition-all duration-200 py-1"
                  >
                    {cat}
                  </a>
                ))}
              </nav>
            </div>

            <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-4">
              <div className="text-[10px] font-bold uppercase text-zinc-500 mb-2">Pro Tip</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Use <kbd className="font-mono bg-white/10 rounded px-1 text-white">Ctrl + F</kbd> to search for specific terms quickly.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-16">
          
          {/* Mobile Category Nav */}
          <div className="lg:hidden">
            <div className="text-xs font-bold uppercase text-zinc-500 mb-3">Jump to section</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <a
                  key={cat}
                  href={`#${slugify(cat)}`}
                  className="rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 active:bg-zinc-800"
                >
                  {cat}
                </a>
              ))}
            </div>
          </div>

          {grouped.map(({ cat, terms }) => (
            <section key={cat} id={slugify(cat)} className="scroll-mt-24">
              <div className="flex items-baseline gap-4 mb-6 border-b border-white/5 pb-4">
                <h2 className="text-2xl font-black text-white tracking-tight">{cat}</h2>
                <span className="text-xs font-mono text-zinc-500">{terms.length} terms</span>
              </div>

              <div className="grid gap-4">
                {terms.map((t) => (
                  <TermCard key={t.term} t={t} />
                ))}
              </div>
            </section>
          ))}

          {/* Footer CTA */}
          <section className="rounded-3xl border border-white/5 bg-gradient-to-br from-zinc-900 to-black p-8 text-center">
            <div className="max-w-xl mx-auto">
              <h3 className="text-lg font-bold text-white mb-2">Missing a definition?</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Mining terminology evolves fast. If you're stuck on a term not listed here, check the manufacturers page or the profitability calculator for context.
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/miners/profitability"
                  className="rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-bold hover:bg-zinc-200 transition-colors"
                >
                  Go to Calculator
                </Link>
                <Link
                  href="/miners/manufacturers"
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-colors"
                >
                  Browse Hardware
                </Link>
              </div>
            </div>
          </section>

          <div id="top" />
        </div>
      </div>
    </PageShell>
  );
}