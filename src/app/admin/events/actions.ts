"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MiningEventStatus, MiningEventType } from "@prisma/client";

function slugify(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStr(fd: FormData, key: string) {
  const v = fd.get(key);
  if (typeof v !== "string") return "";
  return v.trim();
}

function getBool(fd: FormData, key: string) {
  const v = fd.get(key);
  // checkbox => "on"
  return v === "on" || v === "true" || v === "1";
}

function parseDateRequired(v: string, fieldName: string) {
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid ${fieldName} date/time`);
  return d;
}

function parseDateOptional(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function parseTags(raw: string): string[] {
  if (!raw) return [];
  // allow "tag1, tag2" or "#tag1 #tag2"
  const cleaned = raw.replace(/#/g, " ");
  const parts = cleaned
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  // de-dupe
  return Array.from(new Set(parts));
}

function parseEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  const v = String(value || "").trim().toUpperCase() as T;
  return (allowed as readonly string[]).includes(v) ? v : fallback;
}

async function ensureUniqueSlug(base: string, excludeId?: string) {
  const s = slugify(base);
  if (!s) return `event-${Date.now()}`;

  // if free, use it
  const existing = await prisma.miningEvent.findFirst({
    where: { slug: s, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (!existing) return s;

  // else suffix
  for (let i = 2; i < 9999; i++) {
    const candidate = `${s}-${i}`;
    const taken = await prisma.miningEvent.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${s}-${Date.now()}`;
}

function normalizeRegionKey(v: string) {
  const r = (v || "GLOBAL").trim().toUpperCase();
  return r || "GLOBAL";
}

// CREATE
export async function createMiningEvent(formData: FormData): Promise<void> {
  const title = getStr(formData, "title");
  if (!title) throw new Error("Title is required.");

  const slugInput = getStr(formData, "slug");
  const slug = await ensureUniqueSlug(slugInput || title);

  const type = parseEnum(
    getStr(formData, "type"),
    ["CONFERENCE", "HARDWARE_LAUNCH", "NETWORK_EVENT", "WEBINAR", "MEETUP", "OTHER"] as const,
    "CONFERENCE"
  ) as MiningEventType;

  const status = parseEnum(
    getStr(formData, "status"),
    ["CONFIRMED", "TENTATIVE", "CANCELLED"] as const,
    "CONFIRMED"
  ) as MiningEventStatus;

  const startAt = parseDateRequired(getStr(formData, "startAt"), "startAt");
  const endAt = parseDateOptional(getStr(formData, "endAt"));

  const timezone = getStr(formData, "timezone") || null;

  const isVirtual = getBool(formData, "isVirtual");
  const venue = getStr(formData, "venue") || null;
  const city = getStr(formData, "city") || null;
  const country = getStr(formData, "country") || null;
  const regionKey = normalizeRegionKey(getStr(formData, "regionKey"));

  const websiteUrl = getStr(formData, "websiteUrl") || null;
  const ticketUrl = getStr(formData, "ticketUrl") || null;
  const imageUrl = getStr(formData, "imageUrl") || null;

  const organizer = getStr(formData, "organizer") || null;
  const description = getStr(formData, "description") || null;

  const tags = parseTags(getStr(formData, "tags"));

  const source = getStr(formData, "source") || null;

  const created = await prisma.miningEvent.create({
    data: {
      title,
      slug,
      type,
      status,
      startAt,
      endAt,
      timezone,
      isVirtual,
      venue,
      city,
      country,
      regionKey,
      websiteUrl,
      ticketUrl,
      imageUrl,
      organizer,
      description,
      tags,
      source,
    },
    select: { id: true },
  });

  revalidatePath("/admin/events");
  redirect(`/admin/events/${created.id}`);
}

// UPDATE
export async function updateMiningEvent(id: string, formData: FormData): Promise<void> {
  if (!id) throw new Error("Missing event id.");

  const title = getStr(formData, "title");
  if (!title) throw new Error("Title is required.");

  const slugInput = getStr(formData, "slug");
  const slug = await ensureUniqueSlug(slugInput || title, id);

  const type = parseEnum(
    getStr(formData, "type"),
    ["CONFERENCE", "HARDWARE_LAUNCH", "NETWORK_EVENT", "WEBINAR", "MEETUP", "OTHER"] as const,
    "CONFERENCE"
  ) as MiningEventType;

  const status = parseEnum(
    getStr(formData, "status"),
    ["CONFIRMED", "TENTATIVE", "CANCELLED"] as const,
    "CONFIRMED"
  ) as MiningEventStatus;

  const startAt = parseDateRequired(getStr(formData, "startAt"), "startAt");
  const endAt = parseDateOptional(getStr(formData, "endAt"));

  const timezone = getStr(formData, "timezone") || null;

  const isVirtual = getBool(formData, "isVirtual");
  const venue = getStr(formData, "venue") || null;
  const city = getStr(formData, "city") || null;
  const country = getStr(formData, "country") || null;
  const regionKey = normalizeRegionKey(getStr(formData, "regionKey"));

  const websiteUrl = getStr(formData, "websiteUrl") || null;
  const ticketUrl = getStr(formData, "ticketUrl") || null;
  const imageUrl = getStr(formData, "imageUrl") || null;

  const organizer = getStr(formData, "organizer") || null;
  const description = getStr(formData, "description") || null;

  const tags = parseTags(getStr(formData, "tags"));
  const source = getStr(formData, "source") || null;

  await prisma.miningEvent.update({
    where: { id },
    data: {
      title,
      slug,
      type,
      status,
      startAt,
      endAt,
      timezone,
      isVirtual,
      venue,
      city,
      country,
      regionKey,
      websiteUrl,
      ticketUrl,
      imageUrl,
      organizer,
      description,
      tags,
      source,
    },
  });

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  redirect(`/admin/events/${id}`);
}

// DELETE
export async function deleteMiningEvent(id: string): Promise<void> {
  if (!id) throw new Error("Missing event id.");

  await prisma.miningEvent.delete({ where: { id } });

  revalidatePath("/admin/events");
  redirect("/admin/events");
}
