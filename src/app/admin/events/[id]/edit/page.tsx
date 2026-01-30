import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import EventForm from "../../ui/EventForm";
import { updateMiningEvent } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Mining Event • MinerChecker Admin" };

function toDatetimeLocal(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  // Keep it “local-like” for datetime-local inputs
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const id = params?.id;
  if (!id) return notFound();

  const ev = await prisma.miningEvent.findUnique({ where: { id } });
  if (!ev) return notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit event</h1>
        <p className="mt-1 text-sm text-white/70">
          Update details, links, location, and schedule.
        </p>
      </div>

      <EventForm
        mode="edit"
        onSubmit={updateMiningEvent.bind(null, id)}
        initial={{
          title: ev.title ?? "",
          slug: ev.slug ?? "",
          type: ev.type,
          status: ev.status,
          startAt: toDatetimeLocal(ev.startAt),
          endAt: toDatetimeLocal(ev.endAt),
          timezone: ev.timezone ?? "",
          isVirtual: ev.isVirtual,
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
        }}
      />
    </div>
  );
}
