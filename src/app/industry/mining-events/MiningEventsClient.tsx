"use client";

import React, { useCallback, useMemo, useState } from "react";

export type MiningEventDTO = {
  id: string;
  slug: string;
  title: string;
  type: "CONFERENCE" | "HARDWARE_LAUNCH" | "NETWORK_EVENT" | "WEBINAR" | "MEETUP" | "OTHER";
  status: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  startISO: string;
  endISO: string | null;
  timezone: string | null;

  isVirtual: boolean;
  venue: string | null;
  city: string | null;
  country: string | null;
  regionKey: string;

  websiteUrl: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;

  organizer: string | null;
  description: string | null;
  tags: string[];
};

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function safeDate(iso: string) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDay(iso: string) {
  const d = safeDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(d);
}

function formatMonth(iso: string) {
  const d = safeDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(d);
}

function formatFullTime(iso: string) {
  const d = safeDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric" }).format(d);
}

function formatLocalDate(iso: string) {
  const d = safeDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

function msUntil(iso: string) {
  const d = safeDate(iso);
  if (!d) return null;
  return d.getTime() - Date.now();
}

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(s / 86400);
  const hrs = Math.floor((s % 86400) / 3600);
  return { days, hrs };
}

function makeICS(ev: MiningEventDTO) {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const start = safeDate(ev.startISO);
  const end = ev.endISO ? safeDate(ev.endISO) : null;
  const endAdj = end ?? (start ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : null);
  const toICSDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dtStart = start ? toICSDate(start) : "";
  const dtEnd = endAdj ? toICSDate(endAdj) : dtStart;
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  const locationParts = [ev.isVirtual ? "Virtual" : null, ev.venue, ev.city, ev.country].filter(Boolean);
  const location = locationParts.length ? locationParts.join(", ") : "";
  const desc = [
    ev.description?.trim() || "",
    ev.websiteUrl ? `\n\nWebsite: ${ev.websiteUrl}` : "",
    ev.ticketUrl ? `\nTickets: ${ev.ticketUrl}` : "",
  ].join("").trim();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MinerChecker//Mining Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escape(ev.id)}@minerchecker`,
    `DTSTAMP:${dtStamp}`,
    dtStart ? `DTSTART:${dtStart}` : "",
    dtEnd ? `DTEND:${dtEnd}` : "",
    `SUMMARY:${escape(ev.title)}`,
    location ? `LOCATION:${escape(location)}` : "",
    desc ? `DESCRIPTION:${escape(desc)}` : "",
    ev.websiteUrl ? `URL:${escape(ev.websiteUrl)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const TYPE_CONFIG: Record<MiningEventDTO["type"], { label: string; tone: "cyan" | "fuchsia" | "emerald" | "amber" | "purple" | "slate" }> = {
  CONFERENCE: { label: "Conference", tone: "cyan" },
  HARDWARE_LAUNCH: { label: "Launch", tone: "fuchsia" },
  NETWORK_EVENT: { label: "Network", tone: "emerald" },
  WEBINAR: { label: "Webinar", tone: "purple" },
  MEETUP: { label: "Meetup", tone: "amber" },
  OTHER: { label: "Event", tone: "slate" },
};

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "cyan" | "fuchsia" | "slate" | "emerald" | "amber" | "purple" | "red";
}) {
  const styles = {
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    slate: "bg-white/5 text-zinc-400 border-white/10",
  };

  return (
    <span className={cn("inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider", styles[tone])}>
      {children}
    </span>
  );
}

export default function MiningEventsClient({ events }: { events: MiningEventDTO[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<MiningEventDTO["type"] | "ALL">("ALL");
  const [region, setRegion] = useState<string | "ALL">("ALL");
  const [showPast, setShowPast] = useState(false);
  const [sort, setSort] = useState<"soonest" | "latest">("soonest");

  const now = Date.now();

  const allRegions = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) set.add(ev.regionKey || "GLOBAL");
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b));
    return arr;
  }, [events]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const out = events.filter((ev) => {
      const start = safeDate(ev.startISO);
      const isPast = start ? start.getTime() < now : false;

      if (!showPast && isPast) return false;
      if (type !== "ALL" && ev.type !== type) return false;
      if (region !== "ALL" && (ev.regionKey || "GLOBAL") !== region) return false;

      if (!needle) return true;

      const locationText = [
        ev.isVirtual ? "Virtual" : "",
        ev.venue ?? "",
        ev.city ?? "",
        ev.country ?? "",
      ].join(" ");

      const hay = [
        ev.title,
        TYPE_CONFIG[ev.type].label,
        ev.regionKey ?? "",
        locationText,
        ev.organizer ?? "",
        ev.description ?? "",
        ...(ev.tags ?? []),
      ].join(" ").toLowerCase();

      return hay.includes(needle);
    });

    out.sort((a, b) => {
      const ta = safeDate(a.startISO)?.getTime() ?? 0;
      const tb = safeDate(b.startISO)?.getTime() ?? 0;
      return sort === "soonest" ? ta - tb : tb - ta;
    });

    return out;
  }, [events, q, type, region, showPast, sort, now]);

  const stats = useMemo(() => {
    const upcoming = events.filter(e => { const d = safeDate(e.startISO); return d && d.getTime() >= now; }).length;
    const past = events.length - upcoming;
    return { upcoming, past };
  }, [events, now]);

  return (
    <div className="space-y-8 pb-20">
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-zinc-900/50 p-8 md:p-10 shadow-2xl">
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-zinc-900/0 to-zinc-950/0 pointer-events-none" />
         <div className="absolute top-0 right-0 h-[400px] w-[400px] -translate-y-1/2 translate-x-1/3 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div className="max-w-2xl">
             <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 mb-6">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
               </span>
               Community Calendar
             </div>
             
             <h1 className="text-4xl font-black text-white tracking-tight md:text-5xl">
               Mining Events <span className="text-zinc-600">Protocol.</span>
             </h1>
             
             <p className="mt-4 text-lg text-zinc-400 leading-relaxed max-w-xl">
               Track major conferences, hardware launches, and network milestones. Sync directly to your calendar so you never miss a block.
             </p>
           </div>

           <div className="flex gap-4">
             <div className="rounded-3xl border border-white/5 bg-black/20 p-5 text-center min-w-[120px]">
               <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Upcoming</div>
               <div className="mt-1 text-3xl font-black text-white">{stats.upcoming}</div>
             </div>
             <div className="rounded-3xl border border-white/5 bg-black/20 p-5 text-center min-w-[120px]">
               <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Archive</div>
               <div className="mt-1 text-3xl font-black text-zinc-600">{stats.past}</div>
             </div>
           </div>
         </div>
      </section>

      {/* 2. CONTROL BAR */}
      <div className="sticky top-4 z-40 rounded-3xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md transition-all">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          
          <div className="flex-1 min-w-[240px]">
            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-cyan-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search events, cities, or organizers..."
                className="w-full h-12 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-cyan-500/50 focus:bg-black/40 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="h-12 px-4 bg-black/20 border border-white/10 rounded-xl text-sm text-zinc-200 outline-none focus:border-cyan-500/50 cursor-pointer hover:bg-white/5 transition-all appearance-none min-w-[160px]"
            >
              <option value="ALL" className="bg-zinc-900">All Types</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k} className="bg-zinc-900">{v.label}</option>
              ))}
            </select>

            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-12 px-4 bg-black/20 border border-white/10 rounded-xl text-sm text-zinc-200 outline-none focus:border-cyan-500/50 cursor-pointer hover:bg-white/5 transition-all appearance-none min-w-[140px]"
            >
              <option value="ALL" className="bg-zinc-900">All Regions</option>
              {allRegions.map((r) => (
                <option key={r} value={r} className="bg-zinc-900">{r}</option>
              ))}
            </select>

            <div className="w-px h-8 bg-white/10 hidden sm:block" />

            <label className="flex items-center gap-3 cursor-pointer bg-black/20 px-4 h-12 rounded-xl border border-white/10 select-none hover:border-white/20 transition-colors">
              <span className="text-sm font-bold text-zinc-300">Past Events</span>
              <input
                type="checkbox"
                checked={showPast}
                onChange={(e) => setShowPast(e.target.checked)}
                className="accent-cyan-500 h-4 w-4 rounded border-zinc-600 bg-zinc-900"
              />
            </label>

            <button
              onClick={() => {
                setQ("");
                setType("ALL");
                setRegion("ALL");
                setShowPast(false);
                setSort("soonest");
              }}
              className="h-12 w-12 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
              title="Reset Filters"
            >
              ↺
            </button>
          </div>
        </div>
      </div>

      {/* 3. EVENTS LIST */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((ev) => {
          const start = safeDate(ev.startISO);
          const isPast = start ? start.getTime() < now : false;
          const until = msUntil(ev.startISO);
          const cd = until != null && until > 0 ? formatCountdown(until) : null;
          
          const config = TYPE_CONFIG[ev.type];
          
          const locationParts = [ev.isVirtual ? "Virtual" : null, ev.venue, ev.city, ev.country].filter(Boolean);
          const locationText = locationParts.join(" • ");

          return (
            <div
              key={ev.id}
              id={ev.slug}
              className={cn(
                "group relative flex flex-col md:flex-row overflow-hidden rounded-3xl border bg-zinc-900/40 p-6 transition-all hover:bg-zinc-900/60 hover:-translate-y-1 hover:shadow-2xl",
                isPast ? "border-white/5 opacity-60 grayscale hover:grayscale-0 hover:opacity-100" : "border-white/10 hover:border-white/20"
              )}
            >
              {/* Date Block */}
              <div className="flex md:flex-col items-center justify-center gap-2 md:gap-0 border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0 md:pr-6 md:mr-6 min-w-[100px] shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{formatMonth(ev.startISO)}</span>
                <span className="text-3xl md:text-4xl font-black text-white">{formatDay(ev.startISO)}</span>
                <span className="text-xs font-mono text-zinc-500 mt-1">{formatFullTime(ev.startISO)}</span>
              </div>

              {/* Content */}
              <div className="flex-1 pt-4 md:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={config.tone}>{config.label}</Pill>
                    {ev.regionKey && <Pill tone="slate">{ev.regionKey}</Pill>}
                    {ev.status === "TENTATIVE" && <Pill tone="amber">Tentative</Pill>}
                    {ev.status === "CANCELLED" && <Pill tone="red">Cancelled</Pill>}
                    {isPast && <Pill tone="slate">Concluded</Pill>}
                  </div>
                  
                  {cd && !isPast && (
                    <div className="text-xs font-mono text-cyan-400 flex items-center gap-2 bg-cyan-500/5 px-2 py-1 rounded-lg border border-cyan-500/10">
                      <span className="animate-pulse">●</span>
                      In {cd.days}d {cd.hrs}h
                    </div>
                  )}
                </div>

                <h3 className="text-2xl font-black text-white tracking-tight mb-2 group-hover:text-cyan-400 transition-colors">
                  {ev.title}
                </h3>

                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>{locationText || "Location TBD"}</span>
                </div>

                {ev.description && (
                  <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed mb-4 max-w-3xl">
                    {ev.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {ev.tags.slice(0, 5).map(t => (
                    <span key={t} className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider bg-black/20 px-2 py-1 rounded border border-white/5">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex md:flex-col gap-2 mt-6 md:mt-0 md:pl-6 md:border-l border-white/5 shrink-0 min-w-[140px] justify-center">
                {ev.websiteUrl && (
                  <a href={ev.websiteUrl} target="_blank" rel="noreferrer" className="flex-1 md:flex-none h-10 flex items-center justify-center rounded-xl bg-white text-black text-xs font-bold uppercase tracking-wide hover:bg-zinc-200 transition-colors shadow-lg">
                    Website ↗
                  </a>
                )}
                {ev.ticketUrl && (
                  <a href={ev.ticketUrl} target="_blank" rel="noreferrer" className="flex-1 md:flex-none h-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 text-xs font-bold uppercase tracking-wide hover:bg-white/10 hover:text-white transition-colors">
                    Tickets
                  </a>
                )}
                <button
                  onClick={() => {
                    const ics = makeICS(ev);
                    const safeName = ev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
                    downloadText(`${safeName}-${formatLocalDate(ev.startISO)}.ics`, ics, "text/calendar;charset=utf-8");
                  }}
                  className="flex-1 md:flex-none h-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-400 text-xs font-bold uppercase tracking-wide hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
                >
                  + Calendar
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 rounded-[3rem] border border-dashed border-white/10 bg-white/5">
          <div className="text-6xl mb-6 opacity-20 grayscale">🗓️</div>
          <h3 className="text-xl font-bold text-white">No events found</h3>
          <p className="mt-2 text-zinc-500 max-w-sm text-center text-sm">
            Try adjusting your filters or enabling "Past Events" to see history.
          </p>
          <button
            onClick={() => {
              setQ("");
              setType("ALL");
              setRegion("ALL");
              setShowPast(false);
              setSort("soonest");
            }}
            className="mt-6 px-6 py-2 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

    </div>
  );
}