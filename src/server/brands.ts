// src/server/brands.ts
import fs from "fs";
import path from "path";

/**
 * Reads brand logo filenames from /public/brands and returns a sorted list of brand keys.
 * Example: /public/brands/bitmain.webp -> "bitmain"
 *
 * Notes:
 * - Runs server-side only (Node runtime). Do NOT import this in client components.
 * - Supports common image extensions; defaults to your .webp folder.
 */
const BRAND_DIR_RELATIVE_TO_CWD = path.join("public", "brands");

const SUPPORTED_EXTS = new Set([".webp", ".png", ".jpg", ".jpeg", ".svg"]);

export function getBrandKeys(): string[] {
  try {
    const absDir = path.join(process.cwd(), BRAND_DIR_RELATIVE_TO_CWD);

    if (!fs.existsSync(absDir)) return [];

    const files = fs.readdirSync(absDir, { withFileTypes: true });

    const keys = files
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => SUPPORTED_EXTS.has(path.extname(name).toLowerCase()))
      .map((name) => path.parse(name).name.trim())
      .filter(Boolean)
      .map((name) => name.toLowerCase())
      .filter((v, i, arr) => arr.indexOf(v) === i) // uniq
      .sort((a, b) => a.localeCompare(b));

    return keys;
  } catch {
    return [];
  }
}
