import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/db";

export const metadata = { title: "Newsletter • MinerChecker" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function clampLen(v: string, max: number) {
  const s = String(v ?? "");
  return s.length > max ? s.slice(0, max) : s;
}

function encodeQ(v: string) {
  return encodeURIComponent(v);
}

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function GlowCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/40 p-6 backdrop-blur-sm transition-all hover:bg-zinc-900/60 hover:border-white/10",
        className
      )}
    >
      {children}
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const subscribed = firstParam(sp.subscribed) === "1";
  const unsubscribed = firstParam(sp.unsubscribed) === "1";
  const error = firstParam(sp.error);
  const tokenFromUrl = firstParam(sp.token);

  // Social proof (optional)
  const activeCount = await prisma.newsletterSubscriber.count({
    where: { status: "ACTIVE" },
  });

  async function subscribe(formData: FormData) {
    "use server";

    const email = clampLen(String(formData.get("email") ?? "").trim(), 180).toLowerCase();
    const hp = String(formData.get("company") ?? "").trim(); // honeypot
    if (hp) redirect("/support/newsletter?subscribed=1");

    if (!email || !isEmail(email)) {
      redirect(`/support/newsletter?error=${encodeQ("Please enter a valid email address.")}`);
    }

    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown";
    const ua = h.get("user-agent") || "unknown";

    // Upsert: if unsubscribed before, resubscribe
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        status: "ACTIVE",
        source: "support/newsletter",
        ip,
        userAgent: ua,
      },
      update: {
        status: "ACTIVE",
        source: "support/newsletter",
        ip,
        userAgent: ua,
      },
    });

    redirect("/support/newsletter?subscribed=1");
  }

  async function unsubscribe(formData: FormData) {
    "use server";

    const token = String(formData.get("token") ?? "").trim();
    if (!token) redirect(`/support/newsletter?error=${encodeQ("Missing unsubscribe token.")}`);

    const updated = await prisma.newsletterSubscriber.updateMany({
      where: { unsubToken: token },
      data: { status: "UNSUBSCRIBED" },
    });

    if (!updated.count) {
      redirect(`/support/newsletter?error=${encodeQ("Invalid or expired unsubscribe link.")}`);
    }

    redirect("/support/newsletter?unsubscribed=1");
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 text-zinc-200">
      <PageShell
        title="Newsletter"
        subtitle="Get product updates, mining market summaries, and new feature announcements — without spam."
      >
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* LEFT: MAIN */}
          <div className="lg:col-span-8 space-y-6">
            <GlowCard className="bg-zinc-900/60 p-8 border-white/10">
              <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 text-xl shadow-lg shadow-cyan-500/20">
                  📨
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white">Subscribe</h2>
                  <p className="text-xs text-zinc-500">
                    Short, useful updates. Unsubscribe anytime.
                  </p>
                </div>
              </div>

              {subscribed ? (
                <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-xl">✅</div>
                    <div>
                      <div className="font-bold text-emerald-400">You’re subscribed</div>
                      <div className="mt-1 text-sm text-zinc-400">
                        Welcome aboard. We’ll send only high-signal updates.
                      </div>
                      <Link
                        href="/miners/profitability"
                        className="mt-4 inline-flex text-xs font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
                      >
                        Check profitability →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}

              {unsubscribed ? (
                <div className="mb-8 rounded-2xl border border-zinc-500/20 bg-white/[0.03] p-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-xl">🧾</div>
                    <div>
                      <div className="font-bold text-white">You’re unsubscribed</div>
                      <div className="mt-1 text-sm text-zinc-400">
                        No more emails. If that was a mistake, you can resubscribe anytime.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-xl">⚠️</div>
                    <div>
                      <div className="font-bold text-red-400">Something went wrong</div>
                      <div className="mt-1 text-sm text-zinc-400">{error}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* If token exists, show unsubscribe UI */}
              {tokenFromUrl ? (
                <form action={unsubscribe} className="space-y-4">
                  <input type="hidden" name="token" value={tokenFromUrl} />
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="text-sm font-bold text-white">Unsubscribe request</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      Click confirm to stop receiving MinerChecker updates.
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Link
                      href="/support/newsletter"
                      className="text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                    >
                      Cancel
                    </Link>
                    <button className="h-11 px-6 rounded-xl bg-white text-zinc-950 text-sm font-bold hover:bg-zinc-200 transition shadow-lg shadow-white/5 active:scale-95">
                      Confirm Unsubscribe
                    </button>
                  </div>
                </form>
              ) : (
                <form action={subscribe} className="space-y-6">
                  {/* Honeypot */}
                  <input name="company" className="hidden" tabIndex={-1} autoComplete="off" />

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">
                      Email address <span className="text-cyan-500">*</span>
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="you@domain.com"
                      className="w-full h-12 rounded-xl bg-black/20 border border-white/10 px-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-black/40 transition-all"
                    />
                    <div className="text-[11px] text-zinc-600">
                      We don’t sell emails. Ever.
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-white/5">
                    <Link
                      href="/support/contact"
                      className="text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                    >
                      Need support instead?
                    </Link>
                    <button className="h-11 px-8 rounded-xl bg-white text-zinc-950 text-sm font-bold hover:bg-zinc-200 transition shadow-lg shadow-white/5 active:scale-95">
                      Subscribe
                    </button>
                  </div>
                </form>
              )}
            </GlowCard>

            <GlowCard className="bg-zinc-900/40">
              <h3 className="text-sm font-bold text-white mb-4">What you’ll get</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-bold text-cyan-400">Market summaries</div>
                  <div className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Hashprice shifts, difficulty trends, and what they mean for ASIC ROI.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-bold text-emerald-400">Product updates</div>
                  <div className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    New pages, new data sources, and profitability engine improvements.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-bold text-purple-400">Vendor trust signals</div>
                  <div className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Verification changes and marketplace integrity improvements.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-bold text-amber-300">Mining ops tips</div>
                  <div className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Cooling, uptime, firmware hygiene, and risk management notes.
                  </div>
                </div>
              </div>
            </GlowCard>
          </div>

          {/* RIGHT: SIDEBAR */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-lg">📈</span> Community signal
              </h3>
              <div className="text-3xl font-black text-white">{activeCount.toLocaleString()}</div>
              <div className="mt-1 text-xs text-zinc-500">
                active subscribers getting MinerChecker updates
              </div>
              <div className="mt-4 text-[11px] text-zinc-500 leading-relaxed">
                We keep it tight: fewer emails, more value.
              </div>
            </div>

            <GlowCard className="bg-zinc-900/60 p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">🔒</span>
                <div className="font-bold text-white text-sm">Privacy</div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                MinerChecker will never request seed phrases, private keys, or passwords.
                Newsletter is informational only.
              </p>
            </GlowCard>

            <GlowCard className="bg-zinc-900/40 p-5">
              <div className="text-sm font-bold text-white mb-2">Want advanced learning?</div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Use our learning hub for fundamentals + operational best practices.
              </p>
              <Link
                href="/resources/learning-hub"
                className="block w-full h-9 rounded-lg border border-white/10 bg-black/20 text-center text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/5 transition flex items-center justify-center"
              >
                Open Learning Hub
              </Link>
            </GlowCard>
          </aside>
        </div>
      </PageShell>
    </div>
  );
}
