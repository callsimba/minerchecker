import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/requireAdmin";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/server/audit";
import { AuditAction } from "@prisma/client";

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

function decToString(v: unknown): string {
  if (v == null) return "";
  // Prisma Decimal has .toString()
  if (typeof v === "object" && v && "toString" in v) return (v as any).toString();
  return String(v);
}

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

  const shippingCostRaw = String(formData.get("shippingCost") ?? "").trim();
  const shippingCost = shippingCostRaw.length ? shippingCostRaw : null;

  const warrantyRaw = formData.get("warrantyMonths");
  const warrantyMonths = warrantyRaw ? Number(warrantyRaw) : null;

  const psuIncluded = String(formData.get("psuIncluded") ?? "off") === "on";

  if (!vendorId || !machineId || !currency || !regionKey || !price) {
    throw new Error("Missing required fields");
  }

  const created = await prisma.vendorOffering.create({
    data: {
      vendorId,
      machineId,
      currency,
      regionKey,
      price, // Prisma Decimal accepts string input
      productUrl,
      inStock,
      shippingCost, // string | null
      warrantyMonths,
      psuIncluded,
    } as any,
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

  const shippingCostRaw = String(formData.get("shippingCost") ?? "").trim();
  const shippingCost = shippingCostRaw.length ? shippingCostRaw : null;

  const warrantyRaw = formData.get("warrantyMonths");
  const warrantyMonths =
    warrantyRaw === null || String(warrantyRaw).trim() === "" ? null : Number(warrantyRaw);

  const psuIncluded = String(formData.get("psuIncluded") ?? "off") === "on";

  if (!offeringId || !price) throw new Error("Missing required fields");

  const before = await prisma.vendorOffering.findUnique({ where: { id: offeringId } });
  if (!before) throw new Error("Offering not found");

  const updated = await prisma.vendorOffering.update({
    where: { id: offeringId },
    data: {
      price,
      productUrl,
      inStock,
      shippingCost,
      warrantyMonths,
      psuIncluded,
    } as any,
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

export default async function OfferingsAdminPage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  await requireAdmin(["admin", "editor"]);

  const sp = (await searchParams) ?? {};
  const machineId = String(sp.machineId ?? "").trim();

  const [vendors, machines, offeringsRaw] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.machine.findMany({ orderBy: { name: "asc" } }),
    prisma.vendorOffering.findMany({
      orderBy: { createdAt: "desc" },
      where: machineId ? { machineId } : undefined,
      include: { vendor: true, machine: true },
      take: 200,
    }),
  ]);

  // ✅ IMPORTANT: convert Decimal -> string so React/Next can serialize into inputs
  const offerings = offeringsRaw.map((o) => ({
    ...o,
    priceStr: decToString(o.price),
    shippingCostStr: o.shippingCost == null ? "" : decToString(o.shippingCost),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Vendor Offerings</h1>
        <p className="mt-1 text-white/70 text-sm">
          Manual prices only. Public “Price” is derived as the lowest offering per machine (per
          currency/region).
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Create offering</h2>

        <form action={createOffering} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            name="vendorId"
            className="md:col-span-2 rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            required
          >
            <option value="">Select vendor</option>
            {vendors
              .filter((v) => v.slug !== "__global__")
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>

          <select
            name="machineId"
            className="md:col-span-2 rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            required
          >
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
            placeholder="Price (2999.00)"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            required
          />

          <input
            name="shippingCost"
            placeholder="Shipping (0 for free)"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
          />

          <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <input
              name="productUrl"
              placeholder="https://vendor.com/product"
              className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            />

            <select
              name="warrantyMonths"
              className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            >
              <option value="">No Warranty / Unknown</option>
              <option value="6">6 Months</option>
              <option value="12">12 Months</option>
              <option value="18">18 Months</option>
              <option value="24">24 Months</option>
            </select>

            <div className="flex items-center gap-4 px-2">
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                <input name="inStock" type="checkbox" defaultChecked className="h-4 w-4" />
                In stock
              </label>
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                <input name="psuIncluded" type="checkbox" className="h-4 w-4" />
                PSU Included
              </label>
            </div>
          </div>

          <button className="md:col-span-4 rounded-xl bg-white text-black font-medium py-2 hover:opacity-90 mt-2">
            Create Offering
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Latest offerings</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-white/70">
              <tr className="border-b border-white/10">
                <th className="py-2 px-2 text-left">Context</th>
                <th className="py-2 px-2 text-left">Financials (Price + Ship)</th>
                <th className="py-2 px-2 text-left">Details (Stock, PSU, Warranty)</th>
                <th className="py-2 px-2 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {offerings.map((o: any) => (
                <tr key={o.id} className="border-b border-white/5 align-top">
                  <td className="py-3 px-2">
                    <div className="font-medium text-white">{o.vendor.name}</div>
                    <div className="text-xs text-white/60">{o.machine.name}</div>
                    <div className="text-xs text-white/40 mt-1">
                      {o.regionKey} • {o.currency}
                    </div>
                  </td>

                  {/* Financials */}
                  <td className="py-3 px-2">
                    <form action={updateOffering} className="flex flex-col gap-2">
                      <input type="hidden" name="offeringId" value={o.id} />
                      <input type="hidden" name="productUrl" value={o.productUrl ?? ""} />
                      <input type="hidden" name="inStock" value={o.inStock ? "on" : "off"} />
                      <input type="hidden" name="psuIncluded" value={o.psuIncluded ? "on" : "off"} />
                      <input type="hidden" name="warrantyMonths" value={o.warrantyMonths ?? ""} />

                      <div className="flex items-center gap-2">
                        <span className="text-xs w-8 text-white/50">Price</span>
                        <input
                          name="price"
                          defaultValue={o.priceStr}
                          className="w-24 rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-right"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs w-8 text-white/50">Ship</span>
                        <input
                          name="shippingCost"
                          defaultValue={o.shippingCostStr}
                          placeholder="0"
                          className="w-24 rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-right text-xs"
                        />
                      </div>

                      <button className="hidden">Save</button>
                    </form>
                  </td>

                  {/* Details */}
                  <td className="py-3 px-2">
                    <form action={updateOffering} className="flex flex-col gap-2">
                      <input type="hidden" name="offeringId" value={o.id} />
                      <input type="hidden" name="price" value={o.priceStr} />
                      <input type="hidden" name="shippingCost" value={o.shippingCostStr} />

                      <div className="flex items-center gap-2">
                        <input
                          name="productUrl"
                          defaultValue={o.productUrl ?? ""}
                          placeholder="https://..."
                          className="w-40 rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-xs"
                        />
                        <button className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-xs transition-colors">
                          💾
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          name="warrantyMonths"
                          defaultValue={o.warrantyMonths ?? ""}
                          className="w-20 rounded-lg bg-black/30 border border-white/10 px-1 py-1 text-xs"
                        >
                          <option value="">War: -</option>
                          <option value="6">6 mo</option>
                          <option value="12">12 mo</option>
                          <option value="18">18 mo</option>
                          <option value="24">24 mo</option>
                        </select>

                        <label className="flex items-center gap-1 cursor-pointer" title="In Stock">
                          <input
                            name="inStock"
                            type="checkbox"
                            defaultChecked={o.inStock}
                            className="h-3 w-3"
                          />
                          <span className="text-xs text-white/60">Stk</span>
                        </label>

                        <label className="flex items-center gap-1 cursor-pointer" title="PSU Included">
                          <input
                            name="psuIncluded"
                            type="checkbox"
                            defaultChecked={o.psuIncluded}
                            className="h-3 w-3"
                          />
                          <span className="text-xs text-white/60">PSU</span>
                        </label>
                      </div>
                    </form>
                  </td>

                  <td className="py-3 px-2 text-right">
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
                  <td colSpan={4} className="py-6 text-center text-white/60">
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
