// src/app/api/cron/profitability/route.ts
import { NextResponse } from "next/server";
import { computeProfitabilitySnapshots } from "@/server/profitability/compute";

export const runtime = "nodejs";

function normalize(v: string | null) {
  return (v ?? "").trim();
}

function isAuthorized(req: Request) {
  const secret = normalize(process.env.CRON_SECRET ?? "");
  const url = new URL(req.url);

  // Dev/local: allow without secrets to simplify testing
  if (process.env.NODE_ENV !== "production") return true;

  // If secret exists, require it (header / bearer / query)
  if (secret) {
    const q = normalize(url.searchParams.get("secret"));
    const hdr = normalize(req.headers.get("x-cron-secret"));
    const auth = normalize(req.headers.get("authorization"));

    if (hdr && hdr === secret) return true;
    if (q && q === secret) return true;

    // Accept "Bearer <secret>" (case-insensitive), and tolerate extra spaces
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && normalize(m[1]) === secret) return true;

    return false;
  }

  // If no secret, only allow if it looks like a Vercel cron call.
  const ua = normalize(req.headers.get("user-agent"));
  return ua.toLowerCase().includes("vercel-cron/");
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await computeProfitabilitySnapshots();
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to compute profitability";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
