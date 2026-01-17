import { prisma } from "@/lib/db";

export type RoleKey = "admin" | "editor" | "viewer";

export async function getUserRoleKeys(userId: string): Promise<RoleKey[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  return rows.map((r) => r.role.key as RoleKey);
}

export async function userHasAnyRole(userId: string, allowed: RoleKey[]) {
  const roles = await getUserRoleKeys(userId);
  return roles.some((r) => allowed.includes(r));
}
