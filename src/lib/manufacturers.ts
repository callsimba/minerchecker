// src/lib/manufacturers.ts
// Auto-generated from brands.zip (manufacturer logos)
// + patched helpers for UI matching (by name/slug/loose key)
// + backward-compatible type alias: ManufacturerRow

export type ManufacturerOption = { slug: string; name: string; logo?: string };

// Backward compat for older imports in pages/components
export type ManufacturerRow = ManufacturerOption;

/**
 * Normalizes a manufacturer input to a stable key:
 * - lowercase
 * - remove non-alphanumeric
 */
export function normalizeManufacturerKey(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const MANUFACTURERS: ManufacturerOption[] = [
  { slug: "aisen", name: "Aisen", logo: "/brands/aisen.webp" },
  { slug: "auradine", name: "Auradine", logo: "/brands/auradine.webp" },
  { slug: "baikal", name: "Baikal", logo: "/brands/baikal.webp" },
  { slug: "bitaxe", name: "BitAxe", logo: "/brands/bitaxe.webp" },
  { slug: "bitdeer", name: "Bitdeer", logo: "/brands/bitdeer.webp" },
  { slug: "bitfily", name: "Bitfily", logo: "/brands/bitfily.webp" },
  { slug: "bitfury", name: "Bitfury", logo: "/brands/bitfury.webp" },
  { slug: "bitmain", name: "Bitmain", logo: "/brands/bitmain.webp" },
  { slug: "bolon", name: "Bolon", logo: "/brands/bolon.webp" },
  { slug: "bombax", name: "Bombax", logo: "/brands/bombax.webp" },
  { slug: "braiins", name: "Braiins", logo: "/brands/braiins.webp" },
  { slug: "bw", name: "BW", logo: "/brands/bw.webp" },
  { slug: "canaan", name: "Canaan", logo: "/brands/canaan.webp" },
  { slug: "dayun", name: "Dayun", logo: "/brands/dayun.webp" },
  { slug: "digital", name: "Digital", logo: "/brands/digital.webp" },
  { slug: "dragonball", name: "Dragonball", logo: "/brands/dragonball.webp" },
  { slug: "ebang", name: "Ebang", logo: "/brands/ebang.webp" },
  { slug: "elphapex", name: "Elphapex", logo: "/brands/elphapex.webp" },
  { slug: "ffminer", name: "FFMiner", logo: "/brands/ffminer.webp" },
  { slug: "fluminer", name: "Fluminer", logo: "/brands/fluminer.webp" },
  { slug: "forestminer", name: "ForestMiner", logo: "/brands/forestminer.webp" },
  { slug: "gmo", name: "GMO", logo: "/brands/gmo.webp" },
  { slug: "goldshell", name: "Goldshell", logo: "/brands/goldshell.webp" },
  { slug: "halong", name: "Halong", logo: "/brands/halong.webp" },
  { slug: "heatbit", name: "Heatbit", logo: "/brands/heatbit.webp" },
  { slug: "holic", name: "Holic", logo: "/brands/holic.webp" },
  { slug: "hummer", name: "Hummer", logo: "/brands/hummer.webp" },
  { slug: "ibelink", name: "iBeLink", logo: "/brands/ibelink.webp" },
  { slug: "iceriver", name: "IceRiver", logo: "/brands/iceriver.webp" },
  { slug: "innosilicon", name: "Innosilicon", logo: "/brands/innosilicon.webp" },
  { slug: "ipollo", name: "iPollo", logo: "/brands/ipollo.webp" },
  { slug: "jasminer", name: "Jasminer", logo: "/brands/jasminer.webp" },
  { slug: "jingleminer", name: "JingleMiner", logo: "/brands/jingleminer.webp" },
  { slug: "lucky", name: "Lucky", logo: "/brands/lucky.webp" },
  { slug: "microbt", name: "MicroBT", logo: "/brands/microbt.webp" },
  { slug: "nerdminer", name: "NerdMiner", logo: "/brands/nerdminer.webp" },
  { slug: "obelisk", name: "Obelisk", logo: "/brands/obelisk.webp" },
  { slug: "pantech", name: "Pantech", logo: "/brands/pantech.webp" },

  // File is pinldea.webp (typo in zip). We keep file path, but fix the display name:
  { slug: "pinldea", name: "PinIdea", logo: "/brands/pinldea.webp" },

  { slug: "plebsource", name: "PlebSource", logo: "/brands/plebsource.webp" },
  { slug: "protorig", name: "ProtoRig", logo: "/brands/protorig.webp" },
  { slug: "spondoolies", name: "Spondoolies", logo: "/brands/spondoolies.webp" },

  // File is strongU.webp (case). Keep file path, but normalize slug matching via helper:
  { slug: "strongU", name: "StrongU", logo: "/brands/strongU.webp" },

  { slug: "todek", name: "Todek", logo: "/brands/todek.webp" },
  { slug: "volcminer", name: "VolcMiner", logo: "/brands/volcminer.webp" },
];

const BY_NAME_KEY = new Map<string, ManufacturerOption>();
const BY_SLUG_KEY = new Map<string, ManufacturerOption>();

for (const m of MANUFACTURERS) {
  BY_NAME_KEY.set(normalizeManufacturerKey(m.name), m);
  BY_SLUG_KEY.set(normalizeManufacturerKey(m.slug), m);
}

export function allManufacturerNames() {
  return MANUFACTURERS.map((m) => m.name).sort((a, b) => a.localeCompare(b));
}

export function findManufacturerByName(name: string) {
  const key = normalizeManufacturerKey(name);
  return BY_NAME_KEY.get(key) ?? null;
}

export function findManufacturerBySlug(slug: string) {
  const key = normalizeManufacturerKey(slug);
  return BY_SLUG_KEY.get(key) ?? null;
}

/**
 * “Loose” resolver:
 * - tries by name
 * - tries by slug
 * - tries by normalized key of the input
 */
export function resolveManufacturer(maybe: string | null | undefined) {
  if (!maybe) return null;
  const key = normalizeManufacturerKey(maybe);
  return BY_NAME_KEY.get(key) ?? BY_SLUG_KEY.get(key) ?? null;
}
