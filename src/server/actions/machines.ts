// src/server/actions/machines.ts

"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/requireAdmin";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/server/audit";
import { AuditAction } from "@prisma/client";

export type DeleteMachineState = {
  ok: boolean;
  message?: string;
};

const INITIAL_DELETE_STATE: DeleteMachineState = { ok: true };

/**
 * Safe delete action that returns a UI-friendly state instead of throwing.
 * This prevents the admin page from crashing when deletion is blocked.
 */
export async function deleteMachineAction(
  _prevState: DeleteMachineState = INITIAL_DELETE_STATE,
  formData: FormData
): Promise<DeleteMachineState> {
  try {
    const { userId } = await requireAdmin(["admin"]);

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, message: "Missing machine id." };

    const before = await prisma.machine.findUnique({
      where: { id },
      include: {
        _count: { select: { vendorOfferings: true } },
      },
    });

    if (!before) return { ok: false, message: "Machine not found." };

    if (before._count.vendorOfferings > 0) {
      return {
        ok: false,
        message: `Cannot delete: ${before._count.vendorOfferings} vendor offering(s) exist. Delete offerings first.`,
      };
    }

    await prisma.machine.delete({ where: { id } });

    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.DELETE,
      entity: "Machine",
      entityId: id,
      before,
      after: null,
    });

    revalidatePath("/admin/machines");
    revalidatePath("/");
    revalidatePath(`/machines/${(before as any).slug}`);

    return { ok: true, message: "Machine deleted." };
  } catch (e: any) {
    // Keep it friendly; don't surface stack traces to the UI.
    return { ok: false, message: e?.message ?? "Delete failed." };
  }
}
