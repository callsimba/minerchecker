import EventForm, { type Initial } from "../ui/EventForm";
import { createMiningEvent } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin • New Event" };

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function NewEventPage() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // default to “local” looking time

  const initial: Initial = {
    title: "",
    slug: "",
    type: "CONFERENCE",
    status: "CONFIRMED",
    startAt: toLocalInputValue(now),
    endAt: "",
    timezone: "",
    isVirtual: false,
    venue: "",
    city: "",
    country: "",
    regionKey: "GLOBAL",
    websiteUrl: "",
    ticketUrl: "",
    imageUrl: "",
    organizer: "",
    description: "",
    tags: "",
    source: "",
  };

  return <EventForm mode="create" initial={initial} onSubmit={createMiningEvent} />;
}
