// src/lib/mining-pools.ts
//
// Mining pools are fast-moving (fees, regions, payout rules change).
// This file is intentionally a curated, lightweight directory used to power
// the Mining Pools page UI. Treat values as "typical" and encourage users
// to verify on the pool before committing hash.

export type PoolRegion = "NA" | "EU" | "ASIA" | "GLOBAL";
export type PoolKyc = "none" | "optional" | "required" | "unknown";

export type PayoutMethod =
  | "PPS"
  | "FPPS"
  | "PPLNS"
  | "PROP"
  | "SOLO"
  | "PPS+"
  | "SCORE"
  | "UNKNOWN";

export type MiningPoolEntry = {
  id: string;
  name: string;
  websiteUrl: string;
  payoutMethods: PayoutMethod[];

  /** Coin symbols supported (e.g. BTC, LTC). Filter-friendly. */
  coins: string[];

  /** Typical fee range (percent). Use for comparisons, not as a guarantee. */
  feePct?: { min: number; max: number };

  /** Some pools require an account; some allow anonymous payout address mining. */
  accountRequired?: boolean;

  /** Whether KYC is commonly required for withdrawals/features. */
  kyc?: PoolKyc;

  /** Regions where the pool typically provides servers. */
  regions: PoolRegion[];

  /** Minimum payout threshold (display only; verify on pool). */
  minPayout?: string;

  /** Beginner-friendly notes. */
  notes: string;

  /** Helpful tags for "best for" sorting. */
  bestFor?: Array<
    | "beginner"
    | "lowVariance"
    | "lowFees"
    | "transparent"
    | "decentralization"
    | "altcoins"
    | "nicehashStyle"
    | "proOps"
  >;

  /** Caution flags shown in UI (non-accusatory, just reminders). */
  cautions?: string[];
};

export const MINING_POOLS: MiningPoolEntry[] = [
  {
    id: "braiins",
    name: "Braiins Pool (Slush Pool)",
    websiteUrl: "https://braiins.com/pool",
    payoutMethods: ["SCORE", "PPLNS"],
    coins: ["BTC"],
    feePct: { min: 1.5, max: 2.5 },
    accountRequired: true,
    kyc: "optional",
    regions: ["EU", "NA", "ASIA"],
    minPayout: "Configurable threshold",
    notes: "Well-known BTC pool with strong transparency tooling and operator education. Great if you value visibility and control.",
    bestFor: ["transparent", "decentralization", "proOps"],
  },
  {
    id: "f2pool",
    name: "F2Pool",
    websiteUrl: "https://www.f2pool.com/",
    payoutMethods: ["PPS", "FPPS", "PPLNS"],
    coins: ["BTC", "LTC", "DOGE", "ETC", "ZEC", "KDA", "KAS"],
    feePct: { min: 1.0, max: 4.0 },
    accountRequired: true,
    kyc: "optional",
    regions: ["GLOBAL"],
    minPayout: "Varies by coin",
    notes: "Large multi-coin pool. Convenient if you mine more than one coin family.",
    bestFor: ["altcoins", "beginner"],
    cautions: ["Large pools can concentrate hashrate — consider decentralization trade-offs."],
  },
  {
    id: "antpool",
    name: "AntPool",
    websiteUrl: "https://www.antpool.com/",
    payoutMethods: ["PPS", "FPPS", "PPLNS"],
    coins: ["BTC", "BCH", "LTC", "DOGE", "ETC"],
    feePct: { min: 0.0, max: 4.0 },
    accountRequired: true,
    kyc: "optional",
    regions: ["GLOBAL"],
    minPayout: "Varies by coin",
    notes: "Popular and widely used. Offers multiple payout models across major PoW coins.",
    bestFor: ["beginner", "lowVariance"],
  },
  {
    id: "viabtc",
    name: "ViaBTC",
    websiteUrl: "https://www.viabtc.com/",
    payoutMethods: ["PPS", "PPLNS"],
    coins: ["BTC", "BCH", "LTC", "DOGE", "ZEC", "KDA", "KAS"],
    feePct: { min: 1.0, max: 4.0 },
    accountRequired: true,
    kyc: "optional",
    regions: ["GLOBAL"],
    minPayout: "Varies by coin",
    notes: "Multi-coin pool with strong coverage. Common choice for Scrypt (LTC/DOGE) miners.",
    bestFor: ["altcoins", "beginner"],
  },
  {
    id: "luxor",
    name: "Luxor",
    websiteUrl: "https://luxor.tech/",
    payoutMethods: ["FPPS", "PPLNS"],
    coins: ["BTC", "KAS", "KDA", "ZEC"],
    feePct: { min: 1.0, max: 3.0 },
    accountRequired: true,
    kyc: "optional",
    regions: ["NA", "EU", "ASIA"],
    minPayout: "Varies by coin",
    notes: "Operator-focused pool + tooling. Often a good fit for serious ASIC operators who want analytics and support.",
    bestFor: ["proOps", "transparent"],
  },
  {
    id: "foundry",
    name: "Foundry USA",
    websiteUrl: "https://foundrydigital.com/",
    payoutMethods: ["FPPS", "PPS"],
    coins: ["BTC"],
    feePct: { min: 0.0, max: 3.0 },
    accountRequired: true,
    kyc: "required",
    regions: ["NA", "EU"],
    minPayout: "Varies",
    notes: "Institutional BTC mining pool. Often chosen by larger operations seeking enterprise support.",
    bestFor: ["proOps", "lowVariance"],
    cautions: ["KYC/contracting expectations may be heavier than hobby pools."],
  },
  {
    id: "binance",
    name: "Binance Pool",
    websiteUrl: "https://pool.binance.com/",
    payoutMethods: ["FPPS", "PPS"],
    coins: ["BTC", "LTC", "DOGE", "ETC"],
    feePct: { min: 0.5, max: 4.0 },
    accountRequired: true,
    kyc: "required",
    regions: ["GLOBAL"],
    minPayout: "Exchange-linked",
    notes: "Convenient if you already operate inside an exchange ecosystem. Simplifies payouts/trading flow.",
    bestFor: ["beginner", "lowVariance"],
    cautions: ["Exchange-linked workflows can increase custody/withdrawal dependency."],
  },
  {
    id: "btccom",
    name: "BTC.com Pool",
    websiteUrl: "https://pool.btc.com/",
    payoutMethods: ["FPPS", "PPLNS"],
    coins: ["BTC", "BCH"],
    feePct: { min: 1.0, max: 4.0 },
    accountRequired: true,
    kyc: "optional",
    regions: ["GLOBAL"],
    minPayout: "Varies",
    notes: "Bitcoin-focused pool option. Verify current regions/terms as pools evolve over time.",
    bestFor: ["lowVariance"],
  },
  {
    id: "emcd",
    name: "EMCD",
    websiteUrl: "https://emcd.io/",
    payoutMethods: ["FPPS", "PPLNS"],
    coins: ["BTC", "LTC", "DOGE"],
    feePct: { min: 1.0, max: 3.0 },
    accountRequired: true,
    kyc: "optional",
    regions: ["EU", "NA", "ASIA"],
    minPayout: "Varies",
    notes: "Multi-coin pool with a simple operator experience. Check whether it fits your region and payout preferences.",
    bestFor: ["beginner"],
  },
  {
    id: "nicehash",
    name: "NiceHash (hashpower marketplace)",
    websiteUrl: "https://www.nicehash.com/",
    payoutMethods: ["UNKNOWN"],
    coins: ["BTC"],
    feePct: { min: 2.0, max: 5.0 },
    accountRequired: true,
    kyc: "required",
    regions: ["GLOBAL"],
    minPayout: "Varies",
    notes: "Not a traditional pool. You sell hashpower and get paid (typically BTC). Useful for simplicity, but pricing/fees differ from direct mining.",
    bestFor: ["nicehashStyle", "beginner"],
    cautions: ["Marketplace payout is not the same as direct coin mining. Compare net profit carefully."],
  },
  {
    id: "miningdutch",
    name: "Mining-Dutch",
    websiteUrl: "https://www.mining-dutch.nl/",
    payoutMethods: ["PPLNS", "PROP"],
    coins: ["LTC", "DOGE", "KDA", "ZEC"],
    feePct: { min: 0.5, max: 2.5 },
    accountRequired: true,
    kyc: "optional",
    regions: ["EU", "NA"],
    minPayout: "Varies",
    notes: "Smaller multi-coin pool that can be attractive for decentralization-minded miners.",
    bestFor: ["decentralization", "altcoins", "lowFees"],
  },
  {
    id: "litecoinpool",
    name: "Litecoinpool.org",
    websiteUrl: "https://www.litecoinpool.org/",
    payoutMethods: ["PPS", "PPLNS"],
    coins: ["LTC"],
    feePct: { min: 0.0, max: 2.0 },
    accountRequired: true,
    kyc: "none",
    regions: ["GLOBAL"],
    minPayout: "Configurable threshold",
    notes: "Long-running Scrypt pool option focused on Litecoin. Good if you're primarily on LTC.",
    bestFor: ["lowVariance", "transparent"],
  },
  {
    id: "2miners",
    name: "2Miners",
    websiteUrl: "https://2miners.com/",
    payoutMethods: ["PPLNS"],
    coins: ["ETC", "ZEC", "KAS"],
    feePct: { min: 1.0, max: 2.0 },
    accountRequired: false,
    kyc: "none",
    regions: ["EU", "NA", "ASIA"],
    minPayout: "Varies",
    notes: "Often offers address-based mining (no account needed). Simple dashboards, good for quick starts on supported coins.",
    bestFor: ["beginner", "decentralization"],
  },
  {
    id: "nanopool",
    name: "Nanopool",
    websiteUrl: "https://nanopool.org/",
    payoutMethods: ["PPLNS"],
    coins: ["ETC", "ZEC"],
    feePct: { min: 1.0, max: 2.0 },
    accountRequired: false,
    kyc: "none",
    regions: ["EU", "NA", "ASIA"],
    minPayout: "Varies",
    notes: "Address-based mining with straightforward stats. Verify supported coins as offerings change.",
    bestFor: ["beginner"],
  },
  {
    id: "k1pool",
    name: "K1Pool",
    websiteUrl: "https://k1pool.com/",
    payoutMethods: ["PPLNS"],
    coins: ["KAS"],
    feePct: { min: 0.8, max: 2.0 },
    accountRequired: false,
    kyc: "none",
    regions: ["EU", "NA", "ASIA"],
    minPayout: "Varies",
    notes: "Smaller, coin-focused option (example: Kaspa). Good for decentralization if it matches your region.",
    bestFor: ["decentralization", "lowFees"],
  },
];