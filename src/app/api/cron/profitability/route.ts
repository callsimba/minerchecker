// src/app/api/cron/profitability/route.ts
import { NextResponse } from "next/server";
import { computeProfitabilitySnapshots } from "@/server/profitability/compute";

export const runtime = "nodejs";

/**
 * CRON auth rules:
 * - In production, require CRON_SECRET (recommended).
 * - Accept either:
 *    1) Header: x-cron-secret: <secret>
 *    2) Authorization: Bearer <secret>
 *    3) Query: ?secret=<secret>
 * - If CRON_SECRET is missing, fall back to checking Vercel cron UA.
 */
function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);

  // Local/dev: allow without secrets to simplify testing.
  if (process.env.NODE_ENV !== "production") return true;

  // If secret exists, require it
  if (secret && secret.trim().length) {
    const q = url.searchParams.get("secret");
    const auth = req.headers.get("authorization");
    const hdr = req.headers.get("x-cron-secret");

    if (hdr === secret) return true;
    if (q === secret) return true;
    if (auth === `Bearer ${secret}`) return true;

    return false;
  }

  // If no secret, at least ensure it looks like a Vercel cron call.
  const ua = req.headers.get("user-agent") ?? "";
  return ua.includes("vercel-cron/");
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await computeProfitabilitySnapshots();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to compute profitability" },
      { status: 500 }
    );
  }
}
