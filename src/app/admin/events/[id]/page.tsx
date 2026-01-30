// src/app/admin/events/[id]/page.tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import EventForm, { type Initial } from "../ui/EventForm";
import { updateMiningEvent, deleteMiningEvent } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin • Edit Event" };

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  // convert to "local-looking" datetime-local value
  const copy = new Date(d);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return `${copy.getFullYear()}-${pad(copy.getMonth() + 1)}-${pad(copy.getDate())}T${pad(copy.getHours())}:${pad(copy.getMinutes())}`;
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) return notFound();

  const ev = await prisma.miningEvent.findUnique({
    where: { id },
  });

  if (!ev) return notFound();

  const initial: Initial = {
    title: ev.title ?? "",
    slug: ev.slug ?? "",
    type: ev.type,
    status: ev.status,
    startAt: toLocalInputValue(ev.startAt),
    endAt: ev.endAt ? toLocalInputValue(ev.endAt) : "",
    timezone: ev.timezone ?? "",
    isVirtual: ev.isVirtual ?? false,
    venue: ev.venue ?? "",
    city: ev.city ?? "",
    country: ev.country ?? "",
    regionKey: ev.regionKey ?? "GLOBAL",
    websiteUrl: ev.websiteUrl ?? "",
    ticketUrl: ev.ticketUrl ?? "",
    imageUrl: ev.imageUrl ?? "",
    organizer: ev.organizer ?? "",
    description: ev.description ?? "",
    tags: (ev.tags ?? []).join(", "),
    source: ev.source ?? "",
  };

  // Bind action so EventForm receives (formData) => Promise<void>
  const onSubmit = updateMiningEvent.bind(null, id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Edit event</h1>
          <p className="mt-1 text-sm text-white/60">
            ID: <span className="font-mono text-white/80">{id}</span>
          </p>
        </div>

        <form action={async () => { "use server"; await deleteMiningEvent(id); }}>
          <button className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20">
            Delete
          </button>
        </form>
      </div>

      <EventForm mode="edit" initial={initial} onSubmit={onSubmit} />
    </div>
  );
}
