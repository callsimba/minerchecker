"use client";

import React, { useMemo, useState } from "react";

export type Initial = {
  title: string;
  slug: string;
  type: string;
  status: string;
  startAt: string; // datetime-local value
  endAt: string;   // datetime-local value (optional)
  timezone: string;

  isVirtual: boolean;
  venue: string;
  city: string;
  country: string;
  regionKey: string;

  websiteUrl: string;
  ticketUrl: string;
  imageUrl: string;

  organizer: string;
  description: string;

  tags: string;   // comma-separated
  source: string;
};

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{label}</div>
      <div className="mt-2">{children}</div>
      {hint ? <div className="mt-2 text-xs text-white/50">{hint}</div> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none",
        "placeholder:text-white/35 focus:border-cyan-400/40"
      )}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none",
        "placeholder:text-white/35 focus:border-cyan-400/40"
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none",
        "focus:border-cyan-400/40"
      )}
    />
  );
}

export default function EventForm({
  mode,
  onSubmit,
  initial,
}: {
  mode: "create" | "edit";
  onSubmit: (formData: FormData) => Promise<void>;
  initial: Initial;
}) {
  const [saving, setSaving] = useState(false);

  const title = useMemo(() => (mode === "create" ? "Create event" : "Update event"), [mode]);

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        try {
          await onSubmit(fd);
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-5"
    >
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold">{title}</div>
          <div className="mt-1 text-sm text-white/60">
            Add conferences, network events, launches, webinars, meetups.
          </div>
        </div>

        <button
          disabled={saving}
          className={cn(
            "h-11 rounded-2xl px-5 font-semibold",
            "bg-white text-black hover:bg-white/90",
            saving && "opacity-60 cursor-not-allowed"
          )}
        >
          {saving ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <Input name="title" defaultValue={initial.title} placeholder="e.g. Mining Disrupt 2026" required />
        </Field>

        <Field label="Slug" hint="Leave blank to auto-generate from title. Must be unique.">
          <Input name="slug" defaultValue={initial.slug} placeholder="mining-disrupt-2026" />
        </Field>

        <Field label="Type">
          <Select name="type" defaultValue={initial.type}>
            <option value="CONFERENCE">Conference</option>
            <option value="HARDWARE_LAUNCH">Hardware launch</option>
            <option value="NETWORK_EVENT">Network event</option>
            <option value="WEBINAR">Webinar</option>
            <option value="MEETUP">Meetup</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>

        <Field label="Status">
          <Select name="status" defaultValue={initial.status}>
            <option value="CONFIRMED">Confirmed</option>
            <option value="TENTATIVE">Tentative</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </Field>

        <Field label="Start date/time">
          <Input name="startAt" type="datetime-local" defaultValue={initial.startAt} required />
        </Field>

        <Field label="End date/time (optional)">
          <Input name="endAt" type="datetime-local" defaultValue={initial.endAt} />
        </Field>

        <Field label="Timezone (optional)" hint='IANA TZ like "America/Los_Angeles"'>
          <Input name="timezone" defaultValue={initial.timezone} placeholder="America/Los_Angeles" />
        </Field>

        <Field label="Region key" hint="Matches your offerings regions (GLOBAL, US, EU, UK, ASIA, CN...)">
          <Input name="regionKey" defaultValue={initial.regionKey} placeholder="GLOBAL" />
        </Field>

        <Field label="Virtual event">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isVirtual"
              defaultChecked={initial.isVirtual}
              className="h-4 w-4 accent-cyan-400"
            />
            <span className="text-sm text-white/70">This event is online/virtual</span>
          </div>
        </Field>

        <Field label="Venue (optional)">
          <Input name="venue" defaultValue={initial.venue} placeholder="Convention Center / Hotel / Online" />
        </Field>

        <Field label="City (optional)">
          <Input name="city" defaultValue={initial.city} placeholder="Las Vegas" />
        </Field>

        <Field label="Country (optional)">
          <Input name="country" defaultValue={initial.country} placeholder="United States" />
        </Field>

        <Field label="Website URL (optional)">
          <Input name="websiteUrl" defaultValue={initial.websiteUrl} placeholder="https://..." />
        </Field>

        <Field label="Ticket URL (optional)">
          <Input name="ticketUrl" defaultValue={initial.ticketUrl} placeholder="https://..." />
        </Field>

        <Field label="Image URL (optional)">
          <Input name="imageUrl" defaultValue={initial.imageUrl} placeholder="https://..." />
        </Field>

        <Field label="Organizer (optional)">
          <Input name="organizer" defaultValue={initial.organizer} placeholder="Company / org name" />
        </Field>

        <Field label="Tags (comma-separated)" hint="e.g. conference, mining, bitcoin, asic">
          <Input name="tags" defaultValue={initial.tags} placeholder="conference, bitcoin, asic" />
        </Field>

        <Field label="Source (optional)" hint='e.g. "official site", "press release"'>
          <Input name="source" defaultValue={initial.source} placeholder="official site" />
        </Field>

        <div className="md:col-span-2">
          <Field label="Description (optional)">
            <TextArea name="description" defaultValue={initial.description} placeholder="What is this event about?" />
          </Field>
        </div>
      </div>
    </form>
  );
}
