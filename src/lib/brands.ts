// src/lib/brands.ts
// Aligned to manufacturers.ts so your admin datalist stays in sync.
//
// Goal:
// - Use manufacturers.ts as the single source of truth for brand names + logos.
// - Keep backwards-compatible helpers: normalizeBrandKey, getBrandLabel, getBrandLogoPath
// - Export BRAND_LABELS for <datalist> in admin pages.

import {
  MANUFACTURERS,
  findManufacturerByName,
  allManufacturerNames,
  type ManufacturerOption,
} from "@/lib/manufacturers";

export type BrandDef = {
  key: string;   // normalized key
  label: string; // display label
  file: string;  // filename inside /public/brands
};

export function normalizeBrandKey(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Build BRANDS from MANUFACTURERS (single source of truth)
export const BRANDS: BrandDef[] = MANUFACTURERS.map((m) => ({
  key: normalizeBrandKey(m.name),
  label: m.name,
  // manufacturers.ts stores logo as "/brands/xxx.webp"
  // we keep BrandDef.file as "xxx.webp" for backwards compat
  file: String(m.logo ?? "")
    .replace(/^\/+/, "")     // "brands/xxx.webp"
    .replace(/^brands\//, ""), // "xxx.webp"
}));

const BRAND_BY_KEY = new Map(BRANDS.map((b) => [b.key, b]));

// ✅ Always in sync with MANUFACTURERS
export const BRAND_LABELS = allManufacturerNames();

export function getBrandLabel(maybe: string | null | undefined) {
  if (!maybe) return null;

  // Prefer canonical mapping by manufacturers.ts (handles synonyms/alt names)
  const hit = findManufacturerByName(maybe);
  if (hit) return hit.name;

  // Fallback to the old normalized-key mapping
  const k = normalizeBrandKey(maybe);
  return BRAND_BY_KEY.get(k)?.label ?? maybe;
}

export function getBrandLogoPath(maybe: string | null | undefined) {
  if (!maybe) return null;

  // Prefer canonical mapping by manufacturers.ts (handles synonyms/alt names)
  const hit = findManufacturerByName(maybe);
  if (hit?.logo) return hit.logo;

  // Fallback to old normalized-key mapping
  const k = normalizeBrandKey(maybe);
  const b = BRAND_BY_KEY.get(k);
  return b ? `/brands/${b.file}` : null;
}

// Optional helper if you want richer UI usage elsewhere
export function resolveBrand(maybe: string | null | undefined): {
  name: string;
  logo: string | null;
  inferred: boolean;
} | null {
  if (!maybe) return null;
  const hit = findManufacturerByName(maybe);
  if (hit) return { name: hit.name, logo: hit.logo ?? null, inferred: false };

  const k = normalizeBrandKey(maybe);
  const b = BRAND_BY_KEY.get(k);
  if (!b) return { name: maybe, logo: null, inferred: true };

  return { name: b.label, logo: `/brands/${b.file}`, inferred: true };
}
