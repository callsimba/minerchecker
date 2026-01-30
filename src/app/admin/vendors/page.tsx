// src/app/admin/vendors/page.tsx

import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/requireAdmin";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import Image from "next/image"; // ✅ Added for rendering logos
import { writeAuditLog } from "@/server/audit";
import { AuditAction, TrustLevel } from "@prisma/client";

// ---------- Image Upload Helper ----------
const VENDOR_LOGO_DIR = path.join(process.cwd(), "public", "vendors");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT = new Map<string, string>([
  ["image/webp", "webp"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
]);

function safeSlugForFilename(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function saveVendorLogo(file: File, vendorSlug: string) {
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image too large. Max size is 5MB.");
  }

  const mime = String(file.type ?? "").toLowerCase();
  // Allow basic extensions if mime lookup fails
  let ext = MIME_TO_EXT.get(mime);
  if (!ext) {
    const nameExt = file.name.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(nameExt || "")) {
      ext = nameExt;
    }
  }

  if (!ext) {
    throw new Error("Unsupported image type.");
  }

  await fs.mkdir(VENDOR_LOGO_DIR, { recursive: true });

  const base = safeSlugForFilename(vendorSlug) || "vendor";
  const rand = Math.random().toString(16).slice(2, 8);
  const filename = `${base}-${Date.now()}-${rand}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(VENDOR_LOGO_DIR, filename), buf);

  return `/vendors/${filename}`;
}
// ----------------------------------------

async function createVendor(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const websiteUrlRaw = String(formData.get("websiteUrl") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim(); // ✅ NEW

  const websiteUrl = websiteUrlRaw.length ? websiteUrlRaw : null;

  // ✅ Handle Logo
  const logoFile = formData.get("logoFile");
  let logoUrl: string | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    logoUrl = await saveVendorLogo(logoFile, slug);
  }

  if (!name || !slug) throw new Error("Missing required fields (name, slug)");

  const created = await prisma.vendor.create({
    data: {
      name,
      slug,
      websiteUrl,
      country: country || null,
      logoUrl,
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
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
          />
          
          {/* ✅ Country Input */}
          <input
            name="country"
            placeholder="Country (e.g. China)"
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
          />

          {/* ✅ Logo File Input */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs text-white/60 ml-1">Vendor Logo (Optional)</label>
            <input
              type="file"
              name="logoFile"
              accept="image/*"
              className="block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/80 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-black hover:file:bg-white/90"
            />
          </div>

          <button className="md:col-span-2 rounded-xl bg-white text-black font-medium py-2 hover:opacity-90 mt-2">
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
                <th className="py-2 text-left">Vendor</th>
                <th className="py-2 text-left">Country</th>
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
                    <div className="flex items-center gap-3">
                      {/* ✅ Logo Display */}
                      <div className="h-8 w-8 shrink-0 rounded-full bg-white/10 overflow-hidden border border-white/10 flex items-center justify-center">
                        {v.logoUrl ? (
                          <Image 
                            src={v.logoUrl} 
                            alt={v.name} 
                            width={32} 
                            height={32} 
                            className="h-full w-full object-cover" 
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-white/40">
                            {v.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      <Link className="text-blue-300 hover:underline font-medium" href={`/admin/vendors/${v.id}`}>
                        {v.name}
                      </Link>
                    </div>
                  </td>

                  {/* ✅ Country Display */}
                  <td className="py-2 text-white/80">
                    {v.country || "—"}
                  </td>

                  <td className="py-2 text-white/60">{v.slug}</td>

                  <td className="py-2">
                    <form action={quickUpdateVendor} className="flex items-center gap-3">
                      <input type="hidden" name="vendorId" value={v.id} />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          name="isVerified"
                          type="checkbox"
                          defaultChecked={v.isVerified}
                          className="h-4 w-4 rounded border-white/20 bg-black/40 text-blue-500"
                        />
                        <span className="hidden sm:inline text-white/60 text-xs">Verif</span>
                      </label>

                      <select
                        name="trustLevel"
                        defaultValue={v.trustLevel}
                        className="rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-xs"
                      >
                        <option value="UNKNOWN">UNKN</option>
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MID</option>
                        <option value="HIGH">HIGH</option>
                      </select>

                      <button className="rounded-lg bg-white/10 hover:bg-white/20 text-white px-2 py-1 text-xs font-medium transition-colors">
                        ✓
                      </button>
                    </form>
                  </td>

                  <td className="py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                      ${v.trustLevel === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' : 
                        v.trustLevel === 'MEDIUM' ? 'bg-blue-500/20 text-blue-400' : 
                        v.trustLevel === 'LOW' ? 'bg-red-500/20 text-red-400' : 
                        'bg-white/5 text-white/40'}`}>
                      {v.trustLevel}
                    </span>
                  </td>

                  <td className="py-2 text-right">
                    <form action={deleteVendor}>
                      <input type="hidden" name="vendorId" value={v.id} />
                      <button
                        className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-30 transition-colors"
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
                  <td colSpan={6} className="py-10 text-center text-white/40">
                    No vendors yet. Use the form above to add one.
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