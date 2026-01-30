import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { addSupportReply, updateSupportTicket } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin • Support Ticket" };

type MaybePromise<T> = T | Promise<T>;

export default async function Page({ params }: { params: MaybePromise<{ id: string }> }) {
  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, name: true } },
      assignedTo: { select: { email: true, name: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { actorUser: { select: { email: true, name: true } } },
      },
    },
  });

  if (!ticket) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/support" className="text-sm text-white/70 hover:text-white">
            ← Back to Support
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{ticket.topic}</h1>
          <p className="mt-1 text-sm text-white/70">
            From <span className="text-white">{ticket.name || "—"}</span> •{" "}
            <span className="text-white">{ticket.email}</span>
          </p>
        </div>

        <div className="text-right text-sm text-white/60">
          <div>Created: {new Date(ticket.createdAt).toLocaleString()}</div>
          <div>Updated: {new Date(ticket.updatedAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT: THREAD */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/60">User message</div>
            <div className="mt-2 whitespace-pre-wrap text-white">{ticket.message}</div>
          </div>

          {ticket.replies.map((r: (typeof ticket.replies)[number]) => (
            <div
              key={r.id}
              className={`rounded-2xl border p-5 ${
                r.isInternal ? "border-amber-500/20 bg-amber-500/5" : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-white/60">
                <div>
                  {r.isInternal ? "Internal note" : "Reply"} •{" "}
                  <span className="text-white">
                    {r.actorUser?.email || "system"}
                  </span>
                </div>
                <div>{new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="mt-2 whitespace-pre-wrap">{r.body}</div>
            </div>
          ))}

          {/* Reply form */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="font-semibold">Reply</h3>
            <form action={addSupportReply.bind(null, ticket.id)} className="mt-3 space-y-3">
              <textarea
                name="body"
                rows={6}
                required
                placeholder="Write a reply… (internal notes will only be visible to admins)"
                className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-cyan-500/40"
              />
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input name="isInternal" type="checkbox" className="h-4 w-4 accent-cyan-400" />
                Internal note (admin-only)
              </label>
              <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200">
                Post reply
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: WORKFLOW */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="font-semibold">Workflow</h3>

            <form action={updateSupportTicket.bind(null, ticket.id)} className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-white/60">Status</label>
                <select
                  name="status"
                  defaultValue={ticket.status}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="WAITING_ON_USER">WAITING_ON_USER</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-white/60">Priority</label>
                <select
                  name="priority"
                  defaultValue={ticket.priority}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none"
                >
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-white/60">Admin notes</label>
                <textarea
                  name="adminNotes"
                  defaultValue={ticket.adminNotes || ""}
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none"
                  placeholder="Internal notes (not visible to users)"
                />
              </div>

              <button className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">
                Save changes
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            <div className="font-semibold text-white">Ticket info</div>
            <div className="mt-2">ID: <span className="text-white">{ticket.id}</span></div>
            <div>Replies: <span className="text-white">{ticket.replies.length}</span></div>
            {ticket.user?.email ? (
              <div className="mt-2">
                Linked user: <span className="text-white">{ticket.user.email}</span>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
