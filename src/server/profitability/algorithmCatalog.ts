// src/server/profitability/algorithmCatalog.ts
export type AlgorithmCatalogRow = {
  key: string;               // DB Algorithm.key
  name: string;
  unit: string;              // UI default only
  efficiencyUnit: string;    // UI default only
  niceHashKey?: string;      // normalized NH algo key override
  fallbackRevenueUsdPerUnitPerDay?: number;
};

export const ALGORITHM_CATALOG: AlgorithmCatalogRow[] = [
  // --- NiceHash-aligned ---
  { key: "sha256", name: "SHA-256", unit: "TH/s", efficiencyUnit: "J/TH", niceHashKey: "SHA256" },
  { key: "sha256asicboost", name: "SHA-256 AsicBoost", unit: "TH/s", efficiencyUnit: "J/TH", niceHashKey: "SHA256ASICBOOST" },

  { key: "scrypt", name: "Scrypt", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "SCRYPT" },
  { key: "x11", name: "X11", unit: "GH/s", efficiencyUnit: "J/GH", niceHashKey: "X11" },
  { key: "qubit", name: "Qubit", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "QUBIT" },

  // Canonical NiceHash name:
  { key: "daggerhashimoto", name: "DaggerHashimoto", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "DAGGERHASHIMOTO" },

  // Backward compat: if you previously seeded "ethash", map it to DAGGERHASHIMOTO
  { key: "ethash", name: "Ethash (DaggerHashimoto)", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "DAGGERHASHIMOTO" },

  { key: "etchash", name: "Etchash", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "ETCHASH" },
  { key: "kawpow", name: "KawPow", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "KAWPOW" },

  // NiceHash uses AUTOLYKOS (Ergo)
  { key: "autolykos", name: "Autolykos", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "AUTOLYKOS" },

  // Backward compat: autolykos2 -> AUTOLYKOS
  { key: "autolykos2", name: "Autolykos2", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "AUTOLYKOS" },

  { key: "octopus", name: "Octopus", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "OCTOPUS" },

  // Kaspa
  { key: "kheavyhash", name: "kHeavyHash", unit: "GH/s", efficiencyUnit: "J/GH", niceHashKey: "KHEAVYHASH" },

  { key: "equihash", name: "Equihash", unit: "kSol/s", efficiencyUnit: "J/kSol", niceHashKey: "EQUIHASH" },
  { key: "zhash", name: "ZHash", unit: "kSol/s", efficiencyUnit: "J/kSol", niceHashKey: "ZHASH" },
  { key: "beamv3", name: "BeamV3", unit: "Sol/s", efficiencyUnit: "J/Sol", niceHashKey: "BEAMV3" },

  // RandomX Monero on NiceHash
  { key: "randomxmonero", name: "RandomX (Monero)", unit: "kH/s", efficiencyUnit: "J/kH", niceHashKey: "RANDOMXMONERO" },

  // Backward compat: randomx -> RANDOMXMONERO
  { key: "randomx", name: "RandomX", unit: "kH/s", efficiencyUnit: "J/kH", niceHashKey: "RANDOMXMONERO" },

  { key: "verushash", name: "VerusHash", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "VERUSHASH" },
  { key: "eaglesong", name: "EagleSong", unit: "TH/s", efficiencyUnit: "J/TH", niceHashKey: "EAGLESONG" },

  { key: "alephium", name: "Alephium", unit: "GH/s", efficiencyUnit: "J/GH", niceHashKey: "ALEPHIUM" },
  { key: "fishhash", name: "FishHash", unit: "H/s", efficiencyUnit: "J/H", niceHashKey: "FISHHASH" },
  { key: "neoscrypt", name: "NeoScrypt", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "NEOSCRYPT" },
  { key: "nexapow", name: "NexaPow", unit: "MH/s", efficiencyUnit: "J/MH", niceHashKey: "NEXAPOW" },
  { key: "xelishashv2", name: "XelisHashV2", unit: "H/s", efficiencyUnit: "J/H", niceHashKey: "XELISHASHV2" },
  // ---- Additional PoW algorithms ----

{ key: "blake3", name: "Blake3", unit: "GH/s", efficiencyUnit: "J/GH" },

{ key: "cryptonight", name: "CryptoNight", unit: "kH/s", efficiencyUnit: "J/kH" },
{ key: "cryptonightr", name: "CryptoNightR", unit: "kH/s", efficiencyUnit: "J/kH" },

{ key: "cuckatoo32", name: "Cuckatoo32", unit: "Graph/s", efficiencyUnit: "J/G" },

{ key: "groestl", name: "Groestl", unit: "MH/s", efficiencyUnit: "J/MH" },

{ key: "versahash", name: "VersaHash", unit: "MH/s", efficiencyUnit: "J/MH" },

{ key: "sha512_256d", name: "SHA512/256d", unit: "GH/s", efficiencyUnit: "J/GH" },

{ key: "lyra2rev2", name: "Lyra2REv2", unit: "MH/s", efficiencyUnit: "J/MH" },

{ key: "blake2b_sha3", name: "Blake2B + SHA3", unit: "GH/s", efficiencyUnit: "J/GH" },


  // --- Extra (not necessarily in NiceHash paying map; safe to seed anyway) ---
  { key: "sha3", name: "SHA-3", unit: "GH/s", efficiencyUnit: "J/GH" },
  { key: "skein", name: "Skein", unit: "GH/s", efficiencyUnit: "J/GH" },
  { key: "lyra2rev3", name: "Lyra2REv3", unit: "MH/s", efficiencyUnit: "J/MH" },
];
