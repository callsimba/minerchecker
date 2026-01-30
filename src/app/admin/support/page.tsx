import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin • Support" };

function badgeTone(status: string) {
  if (status === "OPEN") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (status === "IN_PROGRESS") return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";
  if (status === "WAITING_ON_USER") return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  if (status === "RESOLVED") return "bg-purple-500/10 text-purple-300 border-purple-500/20";
  if (status === "CLOSED") return "bg-white/5 text-zinc-300 border-white/10";
  return "bg-white/5 text-zinc-300 border-white/10";
}

export default async function Page() {
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { email: true, name: true } },
      assignedTo: { select: { email: true, name: true } },
      replies: { select: { id: true } },
    },
  });

  const counts = tickets.reduce(
    (acc, t) => {
      acc.total++;
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Support</h1>
          <p className="mt-1 text-sm text-white/70">
            All inbound messages from <span className="text-white">/support/contact</span>.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Total: {counts.total || 0}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Open: {counts.OPEN || 0}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">In progress: {counts.IN_PROGRESS || 0}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Topic</th>
              <th className="px-4 py-3 text-left">From</th>
              <th className="px-4 py-3 text-left">Preview</th>
              <th className="px-4 py-3 text-left">Replies</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeTone(t.status)}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link className="font-semibold hover:underline" href={`/admin/support/${t.id}`}>
                    {t.topic}
                  </Link>
                  <div className="text-xs text-white/50">{t.priority}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{t.name || "—"}</div>
                  <div className="text-xs text-white/60">{t.email}</div>
                </td>
                <td className="px-4 py-3 text-white/70">
                  {(t.message || "").slice(0, 90)}
                  {(t.message || "").length > 90 ? "…" : ""}
                </td>
                <td className="px-4 py-3">{t.replies.length}</td>
                <td className="px-4 py-3 text-white/60">{new Date(t.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {tickets.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-white/60" colSpan={6}>
                  No tickets yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
