import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/requireAdmin";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/server/audit";
import { AuditAction } from "@prisma/client";

async function createOffering(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const vendorId = String(formData.get("vendorId") ?? "").trim();
  const machineId = String(formData.get("machineId") ?? "").trim();
  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const regionKey = String(formData.get("regionKey") ?? "GLOBAL").trim().toUpperCase();
  const price = String(formData.get("price") ?? "").trim();
  const productUrlRaw = String(formData.get("productUrl") ?? "").trim();
  const productUrl = productUrlRaw.length ? productUrlRaw : null;
  const inStock = String(formData.get("inStock") ?? "on") === "on";

  if (!vendorId || !machineId || !currency || !regionKey || !price) {
    throw new Error("Missing required fields");
  }

  const created = await prisma.vendorOffering.create({
    data: { vendorId, machineId, currency, regionKey, price, productUrl, inStock },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CREATE,
    entity: "VendorOffering",
    entityId: created.id,
    after: created,
  });

  revalidatePath("/admin/offerings");
  revalidatePath(`/admin/vendors/${vendorId}`);
}

async function updateOffering(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const offeringId = String(formData.get("offeringId") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  const productUrlRaw = String(formData.get("productUrl") ?? "").trim();
  const productUrl = productUrlRaw.length ? productUrlRaw : null;
  const inStock = String(formData.get("inStock") ?? "off") === "on";

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

export default async function OfferingsAdminPage() {
  await requireAdmin(["admin", "editor"]);

  const [vendors, machines, offerings] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.machine.findMany({ orderBy: { name: "asc" } }),
    prisma.vendorOffering.findMany({
      orderBy: { createdAt: "desc" },
      include: { vendor: true, machine: true },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Vendor Offerings</h1>
        <p className="mt-1 text-white/70 text-sm">
          Manual prices only. Public “Price” is derived as the lowest offering per machine (per currency/region).
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Create offering</h2>

        <form action={createOffering} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select name="vendorId" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2" required>
            <option value="">Select vendor</option>
            {vendors
              .filter((v) => v.slug !== "__global__")
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>

          <select name="machineId" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2" required>
            <option value="">Select machine</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <input
            name="currency"
            defaultValue="USD"
            placeholder="USD"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
          />
          <input
            name="regionKey"
            defaultValue="GLOBAL"
            placeholder="GLOBAL"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
          />

          <input
            name="price"
            placeholder="2999.00"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            required
          />
          <input
            name="productUrl"
            placeholder="https://vendor.com/product"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
          />

          <label className="flex items-center gap-2 text-sm text-white/80">
            <input name="inStock" type="checkbox" defaultChecked className="h-4 w-4" />
            In stock
          </label>

          <button className="md:col-span-2 rounded-xl bg-white text-black font-medium py-2 hover:opacity-90">
            Create
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Latest offerings</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/70">
              <tr className="border-b border-white/10">
                <th className="py-2 text-left">Vendor</th>
                <th className="py-2 text-left">Machine</th>
                <th className="py-2 text-left">Currency</th>
                <th className="py-2 text-left">Region</th>
                <th className="py-2 text-left">Price</th>
                <th className="py-2 text-left">Stock</th>
                <th className="py-2 text-left">URL</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => (
                <tr key={o.id} className="border-b border-white/5 align-top">
                  <td className="py-2">{o.vendor.name}</td>
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
                      <button className="rounded-lg bg-white text-black px-3 py-1 text-xs font-medium hover:opacity-90">
                        Save
                      </button>
                    </form>
                  </td>

                  <td className="py-2">
                    <form action={updateOffering} className="flex items-center gap-2">
                      <input type="hidden" name="offeringId" value={o.id} />
                      <input type="hidden" name="price" value={o.price} />
                      <input
                        type="hidden"
                        name="productUrl"
                        value={o.productUrl ?? ""}
                      />
                      <label className="flex items-center gap-2 text-xs text-white/70">
                        <input name="inStock" type="checkbox" defaultChecked={o.inStock} className="h-4 w-4" />
                        In stock
                      </label>
                      <button className="rounded-lg bg-white text-black px-3 py-1 text-xs font-medium hover:opacity-90">
                        Save
                      </button>
                    </form>
                  </td>

                  <td className="py-2">
                    <form action={updateOffering} className="flex items-center gap-2">
                      <input type="hidden" name="offeringId" value={o.id} />
                      <input type="hidden" name="price" value={o.price} />
                      <input
                        name="productUrl"
                        defaultValue={o.productUrl ?? ""}
                        placeholder="https://..."
                        className="w-[220px] rounded-lg bg-black/30 border border-white/10 px-2 py-1"
                      />
                      <input type="hidden" name="inStock" value={o.inStock ? "on" : "off"} />
                      <button className="rounded-lg bg-white text-black px-3 py-1 text-xs font-medium hover:opacity-90">
                        Save
                      </button>
                    </form>
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

              {offerings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-white/60">
                    No offerings yet.
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
