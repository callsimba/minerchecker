import { prisma } from "@/lib/db";
import { AuditAction } from "@prisma/client";

type AuditInput = {
  actorUserId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before ?? null,
      after: input.after ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
