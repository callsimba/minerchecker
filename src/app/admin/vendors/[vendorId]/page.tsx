import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/requireAdmin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/server/audit";
import { AuditAction, TrustLevel } from "@prisma/client";

type PageProps = {
  params: Promise<{ vendorId: string }>;
};

async function updateVendor(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const vendorId = String(formData.get("vendorId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const websiteUrlRaw = String(formData.get("websiteUrl") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const trustLevel = String(formData.get("trustLevel") ?? "UNKNOWN").trim() as TrustLevel;
  const isVerified = String(formData.get("isVerified") ?? "off") === "on";

  const websiteUrl = websiteUrlRaw.length ? websiteUrlRaw : null;
  const notes = notesRaw.length ? notesRaw : null;

  if (!vendorId || !name) throw new Error("Missing required fields");

  const before = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!before) throw new Error("Vendor not found");

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { name, websiteUrl, notes, trustLevel, isVerified },
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
  revalidatePath(`/admin/vendors/${vendorId}`);
}

async function deleteVendor(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin"]);

  const vendorId = String(formData.get("vendorId") ?? "").trim();
  if (!vendorId) throw new Error("Missing vendorId");

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return;

  // Protect system global vendor.
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
  redirect("/admin/vendors");
}

async function updateOffering(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const offeringId = String(formData.get("offeringId") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  const productUrlRaw = String(formData.get("productUrl") ?? "").trim();
  const inStock = String(formData.get("inStock") ?? "off") === "on";

  const productUrl = productUrlRaw.length ? productUrlRaw : null;

  if (!offeringId || !price) throw new Error("Missing required fields");

  const before = await prisma.vendorOffering.findUnique({ where: { id: offeringId } });
  if (!before) throw new Error("Offering not found");

  const updated = await prisma.vendorOffering.update({
    where: { id: offeringId },
    data: { price, productUrl, inStock },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.UPDATE,
    entity: "VendorOffering",
    entityId: updated.id,
    before,
    after: updated,
  });

  revalidatePath("/admin/offerings");
  revalidatePath(`/admin/vendors/${before.vendorId}`);
}

async function deleteOffering(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const offeringId = String(formData.get("offeringId") ?? "").trim();
  if (!offeringId) throw new Error("Missing offeringId");

  const before = await prisma.vendorOffering.findUnique({ where: { id: offeringId } });
  if (!before) return;

  await prisma.vendorOffering.delete({ where: { id: offeringId } });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DELETE,
    entity: "VendorOffering",
    entityId: offeringId,
    before,
    after: null,
  });

  revalidatePath("/admin/offerings");
  revalidatePath(`/admin/vendors/${before.vendorId}`);
}

export default async function AdminVendorDetailPage({ params }: PageProps) {
  await requireAdmin(["admin", "editor"]);
  const { vendorId } = await params;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Vendor not found</h1>
        <p className="text-white/70">This vendor ID does not exist.</p>
      </div>
    );
  }

  const offerings = await prisma.vendorOffering.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
    include: { machine: true },
    take: 500,
  });

  const machineCount = new Set(offerings.map((o) => o.machineId)).size;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{vendor.name}</h1>
            <p className="mt-1 text-sm text-white/70">
              Mini profile + machines offered. (Manual prices only)
            </p>
          </div>

          <form action={deleteVendor}>
            <input type="hidden" name="vendorId" value={vendor.id} />
            <button
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
              disabled={vendor.slug === "__global__"}
              title={vendor.slug === "__global__" ? "SYSTEM vendor cannot be deleted" : "Delete vendor"}
            >
              Delete vendor
            </button>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/60">Verified</div>
            <div className="mt-1 text-lg font-semibold">{vendor.isVerified ? "Yes" : "No"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/60">Trust level</div>
            <div className="mt-1 text-lg font-semibold">{vendor.trustLevel}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/60">Machines offered</div>
            <div className="mt-1 text-lg font-semibold">{machineCount}</div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Edit vendor</h2>

        <form action={updateVendor} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input type="hidden" name="vendorId" value={vendor.id} />

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Name</label>
            <input
              name="name"
              defaultValue={vendor.name}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Website URL</label>
            <input
              name="websiteUrl"
              defaultValue={vendor.websiteUrl ?? ""}
              placeholder="https://vendor.com"
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Trust level</label>
            <select
              name="trustLevel"
              defaultValue={vendor.trustLevel}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            >
              <option value="UNKNOWN">UNKNOWN</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input name="isVerified" type="checkbox" defaultChecked={vendor.isVerified} className="h-4 w-4" />
              Verified
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Notes</label>
            <textarea
              name="notes"
              defaultValue={vendor.notes ?? ""}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 min-h-[90px]"
              placeholder="Internal notes (optional)"
            />
          </div>

          <button className="md:col-span-2 rounded-xl bg-white text-black font-medium py-2 hover:opacity-90">
            Save changes
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Offerings by this vendor</h2>
        <p className="mt-1 text-sm text-white/70">
          Machines offered are derived from VendorOfferings (manual).
        </p>

        {offerings.length === 0 ? (
          <p className="mt-4 text-sm text-white/70">No offerings yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/70">
                <tr className="border-b border-white/10">
                  <th className="py-2 text-left">Machine</th>
                  <th className="py-2 text-left">Currency</th>
                  <th className="py-2 text-left">Region</th>
                  <th className="py-2 text-left">Price</th>
                  <th className="py-2 text-left">Stock</th>
                  <th className="py-2 text-left">Product URL</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((o) => (
                  <tr key={o.id} className="border-b border-white/5 align-top">
                    <td className="py-2">{o.machine.name}</td>
                    <td className="py-2">{o.currency}</td>
                    <td className="py-2">{o.regionKey}</td>

                    <td className="py-2">
                      <form action={updateOffering} className="flex items-center gap-2">
                        <input type="hidden" name="offeringId" value={o.id} />
                        <input
                          name="price"
                          defaultValue={o.price}
                          className="w-28 rounded-lg bg-black/30 border border-white/10 px-2 py-1"
                        />
                        <label className="flex items-center gap-2 text-xs text-white/70">
                          <input name="inStock" type="checkbox" defaultChecked={o.inStock} className="h-4 w-4" />
                          In stock
                        </label>
                        <input
                          name="productUrl"
                          defaultValue={o.productUrl ?? ""}
                          placeholder="https://..."
                          className="min-w-[220px] flex-1 rounded-lg bg-black/30 border border-white/10 px-2 py-1"
                        />
                        <button className="rounded-lg bg-white text-black px-3 py-1 text-xs font-medium hover:opacity-90">
                          Save
                        </button>
                      </form>
                    </td>

                    <td className="py-2">{o.inStock ? "Yes" : "No"}</td>
                    <td className="py-2">
                      {o.productUrl ? (
                        <a className="text-blue-300 hover:underline" href={o.productUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>

                    <td className="py-2 text-right">
                      <form action={deleteOffering}>
                        <input type="hidden" name="offeringId" value={o.id} />
                        <button className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
