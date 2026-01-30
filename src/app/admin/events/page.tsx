import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin • Events" };

export default async function AdminEventsPage() {
  const events = await prisma.miningEvent.findMany({
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      startAt: true,
      city: true,
      country: true,
      isVirtual: true,
      regionKey: true,
    },
    take: 500,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Mining Events</h1>
          <p className="mt-1 text-sm text-white/60">Create and manage the industry calendar.</p>
        </div>

        <Link
          href="/admin/events/new"
          className="h-11 inline-flex items-center rounded-2xl px-5 font-semibold bg-white text-black hover:bg-white/90"
        >
          + New event
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-[1.2fr_.5fr_.5fr_.7fr] gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/50">
          <div>Event</div>
          <div>Type</div>
          <div>Status</div>
          <div>When / Where</div>
        </div>

        <div className="divide-y divide-white/10">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/admin/events/${e.id}`}
              className="grid grid-cols-[1.2fr_.5fr_.5fr_.7fr] gap-3 px-4 py-3 hover:bg-white/5"
            >
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">{e.title}</div>
                <div className="mt-1 text-xs text-white/50">
                  Region: <span className="font-mono text-white/70">{e.regionKey}</span>{" "}
                  {e.isVirtual ? "• Virtual" : ""}
                </div>
              </div>

              <div className="text-sm text-white/70">{e.type}</div>
              <div className="text-sm text-white/70">{e.status}</div>

              <div className="text-sm text-white/70">
                <div>{new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(e.startAt)}</div>
                <div className="text-xs text-white/50">
                  {e.isVirtual ? "Online" : [e.city, e.country].filter(Boolean).join(", ") || "—"}
                </div>
              </div>
            </Link>
          ))}

          {events.length === 0 ? (
            <div className="px-4 py-10 text-center text-white/60">
              No events yet. Create your first one.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
