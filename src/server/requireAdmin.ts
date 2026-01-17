import { auth } from "@/server/auth";
import { userHasAnyRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export type AdminAreaRole = "admin" | "editor" | "viewer";

/**
 * Guards pages/actions inside /admin.
 * - Default: admin only
 * - Can be widened to allow editor/viewer for read-only pages.
 */
export async function requireAdmin(allowedRoles: AdminAreaRole[] = ["admin"]) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  if (!session || !userId) redirect("/login");

  const ok = await userHasAnyRole(userId, allowedRoles);
  if (!ok) redirect("/login");

  return { session, userId };
}
