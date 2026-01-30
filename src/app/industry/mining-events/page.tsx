import MiningEventsClient, { type MiningEventDTO } from "./MiningEventsClient";
import { prisma } from "@/lib/db";

export const metadata = { title: "Mining Events • MinerChecker" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await prisma.miningEvent.findMany({
    orderBy: { startAt: "asc" },
    where: { status: { not: "CANCELLED" } }, // Keep logic same as before
    take: 500,
  });

  const events: MiningEventDTO[] = rows.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    type: e.type,
    status: e.status,
    startISO: e.startAt.toISOString(),
    endISO: e.endAt ? e.endAt.toISOString() : null,
    timezone: e.timezone ?? null,

    isVirtual: e.isVirtual,
    venue: e.venue ?? null,
    city: e.city ?? null,
    country: e.country ?? null,
    regionKey: e.regionKey ?? "GLOBAL",

    websiteUrl: e.websiteUrl ?? null,
    ticketUrl: e.ticketUrl ?? null,
    imageUrl: e.imageUrl ?? null,

    organizer: e.organizer ?? null,
    description: e.description ?? null,
    tags: (e.tags ?? []) as string[],
  }));

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200 pt-6">
      <div className="mx-auto max-w-[1450px] px-4 md:px-6">
        <MiningEventsClient events={events} />
      </div>
    </main>
  );
}