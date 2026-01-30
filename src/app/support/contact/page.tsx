import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { auth } from "@/server/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Contact Us • MinerChecker" };

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

/** Reusable glass card */
function GlowCard({ children, className }: { children: React.ReactNode; className?: string }) {
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

export default async function Page({ searchParams }: { searchParams?: MaybePromise<SearchParams> }) {
  const session = await auth();

  const sp = (await searchParams) ?? {};
  const sent = firstParam(sp.sent) === "1";
  const error = firstParam(sp.error);

  async function submitContact(formData: FormData) {
    "use server";

    const session = await auth();

    const name = clampLen(String(formData.get("name") ?? "").trim(), 120);
    const email = clampLen(String(formData.get("email") ?? "").trim(), 180);
    const topic = clampLen(String(formData.get("topic") ?? "").trim(), 80);
    const message = String(formData.get("message") ?? "").trim();

    // honeypot (bots fill hidden fields)
    const company = String(formData.get("company") ?? "").trim();
    if (company) redirect("/support/contact?sent=1");

    if (!email || !isEmail(email)) {
      redirect(`/support/contact?error=${encodeQ("Please enter a valid email.")}`);
    }
    if (!topic) {
      redirect(`/support/contact?error=${encodeQ("Please choose a topic.")}`);
    }
    if (!message || message.length < 20) {
      redirect(`/support/contact?error=${encodeQ("Message is too short (min 20 characters).")}`);
    }
    if (message.length > 5000) {
      redirect(`/support/contact?error=${encodeQ("Message is too long (max 5000 characters).")}`);
    }

    // If user is logged in, link ticket to their User record via email
    let userConnect: { connect: { id: string } } | undefined;
    const sessionEmail = session?.user?.email ?? null;

    if (sessionEmail) {
      const u = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true },
      });
      if (u?.id) userConnect = { connect: { id: u.id } };
    }

    await prisma.supportTicket.create({
      data: {
        name: name || null,
        email,
        topic,
        message,
        status: "OPEN",
        priority: "NORMAL",
        ...(userConnect ? { user: userConnect } : {}),
      },
      select: { id: true },
    });

    redirect("/support/contact?sent=1");
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 text-zinc-200">
      <PageShell
        title="Contact Us"
        subtitle="Direct line to the team. Reach out for data corrections, vendor verification, partnerships, or general support."
      >
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* LEFT: FORM */}
          <div className="lg:col-span-8">
            <GlowCard className="bg-zinc-900/60 p-8 border-white/10">
              <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 text-xl shadow-lg shadow-cyan-500/20">
                  ✉️
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white">New Ticket</h2>
                  <p className="text-xs text-zinc-500">Your message goes straight to the admin support inbox.</p>
                </div>
              </div>

              {sent ? (
                <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-xl">✅</div>
                    <div>
                      <div className="font-bold text-emerald-400">Message received</div>
                      <div className="mt-1 text-sm text-zinc-400">
                        Thanks — your ticket has been submitted to support.
                      </div>
                      <Link
                        href="/"
                        className="mt-4 inline-flex text-xs font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
                      >
                        Return Home →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-xl">⚠️</div>
                    <div>
                      <div className="font-bold text-red-400">Submission failed</div>
                      <div className="mt-1 text-sm text-zinc-400">{error}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <form action={submitContact} className="space-y-6">
                {/* Honeypot */}
                <input name="company" className="hidden" tabIndex={-1} autoComplete="off" />

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">
                      Name (Optional)
                    </label>
                    <input
                      name="name"
                      defaultValue={session?.user?.name ?? ""}
                      placeholder="John Miner"
                      className="w-full h-12 rounded-xl bg-black/20 border border-white/10 px-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-black/40 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">
                      Email Address <span className="text-cyan-500">*</span>
                    </label>
                    <input
                      name="email"
                      defaultValue={session?.user?.email ?? ""}
                      placeholder="operator@miningfarm.com"
                      required
                      className="w-full h-12 rounded-xl bg-black/20 border border-white/10 px-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-black/40 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">
                    Topic <span className="text-cyan-500">*</span>
                  </label>
                  <div className="relative group">
                    <select
                      name="topic"
                      defaultValue="Data correction"
                      required
                      className="w-full h-12 appearance-none rounded-xl bg-black/20 border border-white/10 px-4 text-sm text-zinc-300 outline-none focus:border-cyan-500/50 focus:bg-black/40 transition-all cursor-pointer hover:bg-black/30"
                    >
                      <option className="bg-zinc-900" value="Data correction">
                        Data Correction (Wrong Hashrate/Price)
                      </option>
                      <option className="bg-zinc-900" value="Vendor verification">
                        Vendor Verification Request
                      </option>
                      <option className="bg-zinc-900" value="Partnership">
                        Partnership / Advertising
                      </option>
                      <option className="bg-zinc-900" value="Bug report">
                        Bug Report
                      </option>
                      <option className="bg-zinc-900" value="Feature request">
                        Feature Request
                      </option>
                      <option className="bg-zinc-900" value="Support">
                        General Support
                      </option>
                      <option className="bg-zinc-900" value="Other">
                        Other Inquiry
                      </option>
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 group-hover:text-zinc-300">
                      ▼
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">
                    Message <span className="text-cyan-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={6}
                    placeholder="Describe your request in detail. For data corrections, include machine model + source link."
                    className="w-full rounded-xl bg-black/20 border border-white/10 p-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-cyan-500/50 focus:bg-black/40 transition-all resize-none"
                  />
                  <div className="flex justify-end">
                    <span className="text-[10px] text-zinc-600">Min. 20 characters</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-white/5">
                  <Link href="/" className="text-xs font-bold text-zinc-500 hover:text-white transition-colors">
                    Cancel
                  </Link>
                  <button className="h-11 px-8 rounded-xl bg-white text-zinc-950 text-sm font-bold hover:bg-zinc-200 transition shadow-lg shadow-white/5 active:scale-95">
                    Send Message
                  </button>
                </div>
              </form>
            </GlowCard>
          </div>

          {/* RIGHT: SIDEBAR */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-lg">⚡</span> Fast Track
              </h3>
              <div className="space-y-3">
                <div className="rounded-xl bg-zinc-900/50 border border-white/5 p-3 hover:bg-zinc-900 transition-colors">
                  <div className="text-xs font-bold text-cyan-400 mb-1">Data Correction</div>
                  <div className="text-[11px] text-zinc-500 leading-relaxed">
                    Include machine name, the specific error, and a manufacturer spec link.
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-900/50 border border-white/5 p-3 hover:bg-zinc-900 transition-colors">
                  <div className="text-xs font-bold text-emerald-400 mb-1">Vendor Verification</div>
                  <div className="text-[11px] text-zinc-500 leading-relaxed">
                    Provide proof of domain ownership (DNS TXT) + business details.
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-900/50 border border-white/5 p-3 hover:bg-zinc-900 transition-colors">
                  <div className="text-xs font-bold text-purple-400 mb-1">Bug Reports</div>
                  <div className="text-[11px] text-zinc-500 leading-relaxed">
                    Include screenshots + steps to reproduce.
                  </div>
                </div>
              </div>
            </div>

            <GlowCard className="bg-zinc-900/60 p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">📚</span>
                <div className="font-bold text-white text-sm">Check the FAQ</div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Common questions about ROI math, snapshots, and vendors are answered there.
              </p>
              <Link
                href="/support/faq"
                className="block w-full h-9 rounded-lg border border-white/10 bg-black/20 text-center text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/5 transition flex items-center justify-center"
              >
                Open FAQ
              </Link>
            </GlowCard>

            <div className="rounded-2xl bg-red-500/5 border border-red-500/10 p-5">
              <div className="flex items-start gap-3">
                <span className="text-red-400 text-lg">🛡️</span>
                <div>
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Security</h4>
                  <p className="text-xs text-red-200/60 leading-relaxed">
                    We will <strong>never</strong> ask for seed phrases, private keys, or passwords.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </PageShell>
    </div>
  );
}
