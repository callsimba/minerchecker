"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import { auth } from "@/server/auth";

function getStr(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  const v = String(value || "").trim().toUpperCase() as T;
  return (allowed as readonly string[]).includes(v) ? v : fallback;
}

export async function addSupportReply(ticketId: string, formData: FormData) {
  const session = await auth();

  const body = getStr(formData, "body");
  const isInternal = getStr(formData, "isInternal") === "on";

  if (!ticketId) redirect("/admin/support");
  if (!body || body.length < 2) redirect(`/admin/support/${ticketId}?error=${encodeURIComponent("Reply is too short.")}`);

  const actorEmail = session?.user?.email ?? null;

  await prisma.supportReply.create({
    data: {
      ticket: { connect: { id: ticketId } },
      body,
      isInternal,
      ...(actorEmail ? { actorUser: { connect: { email: actorEmail } } } : {}),
    },
    select: { id: true },
  });

  // bump ticket updatedAt and mark as in progress automatically (optional behavior)
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "IN_PROGRESS" },
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  redirect(`/admin/support/${ticketId}`);
}

export async function updateSupportTicket(ticketId: string, formData: FormData) {
  const status = parseEnum(
    getStr(formData, "status"),
    ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"] as const,
    "OPEN"
  ) as SupportTicketStatus;

  const priority = parseEnum(
    getStr(formData, "priority"),
    ["LOW", "NORMAL", "HIGH", "URGENT"] as const,
    "NORMAL"
  ) as SupportTicketPriority;

  const adminNotes = getStr(formData, "adminNotes") || null;

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status, priority, adminNotes },
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  redirect(`/admin/support/${ticketId}`);
}
