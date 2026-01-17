import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/requireAdmin";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { writeAuditLog } from "@/server/audit";
import { AuditAction, TrustLevel } from "@prisma/client";

async function createVendor(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const websiteUrlRaw = String(formData.get("websiteUrl") ?? "").trim();

  const websiteUrl = websiteUrlRaw.length ? websiteUrlRaw : null;

  if (!name || !slug) throw new Error("Missing required fields");

  const created = await prisma.vendor.create({
    data: {
      name,
      slug,
      websiteUrl,
      trustLevel: TrustLevel.UNKNOWN,
      isVerified: false,
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CREATE,
    entity: "Vendor",
    entityId: created.id,
    after: created,
  });

  revalidatePath("/admin/vendors");
}

async function quickUpdateVendor(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const vendorId = String(formData.get("vendorId") ?? "").trim();
  const trustLevel = String(formData.get("trustLevel") ?? "UNKNOWN").trim() as TrustLevel;
  const isVerified = String(formData.get("isVerified") ?? "off") === "on";

  if (!vendorId) throw new Error("Missing vendorId");

  const before = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!before) throw new Error("Vendor not found");

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { trustLevel, isVerified },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.UPDATE,
    entity: "Vendor",
    entityId: updated.id,
    before,
    after: updated,
  });

  revalidatePath("/admin/vendors");
}

async function deleteVendor(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin"]);

  const vendorId = String(formData.get("vendorId") ?? "").trim();
  if (!vendorId) throw new Error("Missing vendorId");

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return;

  if (vendor.slug === "__global__") {
    throw new Error("SYSTEM: Global vendor cannot be deleted.");
  }

  const before = vendor;

  await prisma.vendor.delete({ where: { id: vendorId } });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DELETE,
    entity: "Vendor",
    entityId: vendorId,
    before,
    after: null,
  });

  revalidatePath("/admin/vendors");
}

export default async function AdminVendorsPage() {
  const { session } = await requireAdmin(["admin", "editor"]);

  const vendors = await prisma.vendor.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <p className="mt-1 text-sm text-white/70">
          Vendors can be verified and assigned trust. Offerings are manual only.
        </p>
        <p className="mt-2 text-sm text-white/70">
          Signed in as:{" "}
          <span className="font-medium text-white">{session?.user?.email ?? "—"}</span>
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Create vendor</h2>

        <form action={createVendor} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            name="name"
            placeholder="Vendor name"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            required
          />
          <input
            name="slug"
            placeholder="vendor-slug"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            required
          />
          <input
            name="websiteUrl"
            placeholder="https://..."
            className="md:col-span-2 rounded-xl bg-black/30 border border-white/10 px-3 py-2"
          />
          <button className="md:col-span-2 rounded-xl bg-white text-black font-medium py-2 hover:opacity-90">
            Create
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Latest vendors</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/70">
              <tr className="border-b border-white/10">
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Slug</th>
                <th className="py-2 text-left">Verified</th>
                <th className="py-2 text-left">Trust</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-b border-white/5">
                  <td className="py-2">
                    <Link className="text-blue-300 hover:underline" href={`/admin/vendors/${v.id}`}>
                      {v.name}
                    </Link>
                  </td>
                  <td className="py-2">{v.slug}</td>

                  <td className="py-2">
                    <form action={quickUpdateVendor} className="flex items-center gap-3">
                      <input type="hidden" name="vendorId" value={v.id} />
                      <label className="flex items-center gap-2">
                        <input
                          name="isVerified"
                          type="checkbox"
                          defaultChecked={v.isVerified}
                          className="h-4 w-4"
                        />
                        <span className="text-white/80">Verified</span>
                      </label>

                      <select
                        name="trustLevel"
                        defaultValue={v.trustLevel}
                        className="rounded-lg bg-black/30 border border-white/10 px-2 py-1"
                      >
                        <option value="UNKNOWN">UNKNOWN</option>
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                      </select>

                      <button className="rounded-lg bg-white text-black px-3 py-1 text-xs font-medium hover:opacity-90">
                        Save
                      </button>
                    </form>
                  </td>

                  <td className="py-2">{v.trustLevel}</td>

                  <td className="py-2 text-right">
                    <form action={deleteVendor}>
                      <input type="hidden" name="vendorId" value={v.id} />
                      <button
                        className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                        disabled={v.slug === "__global__"}
                        title={v.slug === "__global__" ? "SYSTEM vendor cannot be deleted" : "Delete vendor"}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-white/60">
                    No vendors yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
