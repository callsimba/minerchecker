import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/requireAdmin";
import { AuditAction, MachineStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/server/audit";
import { getUserRoleKeys } from "@/lib/rbac";
import { parse } from "csv-parse/sync";

function toNullIfEmpty(v: string) {
  const t = v.trim();
  return t.length ? t : null;
}

function parseDateOrNull(v: string) {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeStatus(v: string): MachineStatus {
  const t = (v || "").trim().toUpperCase();
  if (t === "AVAILABLE" || t === "COMING_SOON" || t === "DISCONTINUED") return t as MachineStatus;
  throw new Error(`Invalid status "${v}". Must be AVAILABLE, COMING_SOON, or DISCONTINUED.`);
}

async function createMachine(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();

  const manufacturer = toNullIfEmpty(String(formData.get("manufacturer") ?? ""));
  const algorithmId = String(formData.get("algorithmId") ?? "").trim();

  const hashrate = String(formData.get("hashrate") ?? "").trim();
  const hashrateUnit = String(formData.get("hashrateUnit") ?? "").trim();

  const powerW = Number(formData.get("powerW") ?? 0);

  const efficiency = toNullIfEmpty(String(formData.get("efficiency") ?? ""));
  const efficiencyUnit = toNullIfEmpty(String(formData.get("efficiencyUnit") ?? ""));

  const releaseDate = parseDateOrNull(String(formData.get("releaseDate") ?? ""));
  const status = String(formData.get("status") ?? "AVAILABLE") as MachineStatus;

  if (!name || !slug || !algorithmId || !hashrate || !hashrateUnit || !powerW) {
    throw new Error("Missing required fields (name, slug, algorithm, hashrate, unit, powerW).");
  }

  const algo = await prisma.algorithm.findUnique({ where: { id: algorithmId } });
  if (!algo) throw new Error("Algorithm not found.");

  const created = await prisma.machine.create({
    data: {
      name,
      slug,
      manufacturer,
      algorithmId,
      hashrate,
      hashrateUnit,
      powerW,
      efficiency,
      efficiencyUnit,
      releaseDate,
      status,
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CREATE,
    entity: "Machine",
    entityId: created.id,
    before: null,
    after: created,
  });

  revalidatePath("/admin/machines");
}

async function updateMachine(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing machine id.");

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();

  const manufacturer = toNullIfEmpty(String(formData.get("manufacturer") ?? ""));
  const algorithmId = String(formData.get("algorithmId") ?? "").trim();

  const hashrate = String(formData.get("hashrate") ?? "").trim();
  const hashrateUnit = String(formData.get("hashrateUnit") ?? "").trim();

  const powerW = Number(formData.get("powerW") ?? 0);

  const efficiency = toNullIfEmpty(String(formData.get("efficiency") ?? ""));
  const efficiencyUnit = toNullIfEmpty(String(formData.get("efficiencyUnit") ?? ""));

  const releaseDate = parseDateOrNull(String(formData.get("releaseDate") ?? ""));
  const status = String(formData.get("status") ?? "AVAILABLE") as MachineStatus;

  if (!name || !slug || !algorithmId || !hashrate || !hashrateUnit || !powerW) {
    throw new Error("Missing required fields (name, slug, algorithm, hashrate, unit, powerW).");
  }

  const before = await prisma.machine.findUnique({ where: { id } });
  if (!before) throw new Error("Machine not found.");

  const algo = await prisma.algorithm.findUnique({ where: { id: algorithmId } });
  if (!algo) throw new Error("Algorithm not found.");

  const after = await prisma.machine.update({
    where: { id },
    data: {
      name,
      slug,
      manufacturer,
      algorithmId,
      hashrate,
      hashrateUnit,
      powerW,
      efficiency,
      efficiencyUnit,
      releaseDate,
      status,
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.UPDATE,
    entity: "Machine",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/admin/machines");
}

async function deleteMachine(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin"]); // admin only

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing machine id.");

  const before = await prisma.machine.findUnique({
    where: { id },
    include: {
      vendorOfferings: { select: { id: true }, take: 1 },
    },
  });
  if (!before) throw new Error("Machine not found.");

  // Safety: block deleting machines that have offerings
  if (before.vendorOfferings.length > 0) {
    throw new Error("Cannot delete machine: it has vendor offerings. Delete offerings first.");
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
}

async function importMachinesCsv(formData: FormData) {
  "use server";
  const { userId } = await requireAdmin(["admin", "editor"]);

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Missing CSV file.");
  }

  const text = await file.text();
  if (!text.trim()) throw new Error("CSV file is empty.");

  // Load algorithms map for fast lookup by key
  const algorithms = await prisma.algorithm.findMany();
  const algoByKey = new Map(algorithms.map((a) => [a.key.toLowerCase(), a]));

  type Row = Record<string, string>;

  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("No rows found in CSV.");
  }

  let createdCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // header is line 1

    try {
      const name = String(row.name ?? "").trim();
      const slug = String(row.slug ?? "").trim();
      const algorithmKey = String(row.algorithmKey ?? "").trim().toLowerCase();

      const hashrate = String(row.hashrate ?? "").trim();
      const hashrateUnit = String(row.hashrateUnit ?? "").trim();
      const powerW = Number(String(row.powerW ?? "").trim());

      const status = normalizeStatus(String(row.status ?? "AVAILABLE"));

      const manufacturer = toNullIfEmpty(String(row.manufacturer ?? ""));
      const releaseDate = parseDateOrNull(String(row.releaseDate ?? ""));
      const efficiency = toNullIfEmpty(String(row.efficiency ?? ""));
      const efficiencyUnit = toNullIfEmpty(String(row.efficiencyUnit ?? ""));

      if (!name || !slug || !algorithmKey || !hashrate || !hashrateUnit || !powerW) {
        throw new Error("Missing required columns: name, slug, algorithmKey, hashrate, hashrateUnit, powerW, status.");
      }

      const algo = algoByKey.get(algorithmKey);
      if (!algo) throw new Error(`Unknown algorithmKey "${algorithmKey}". Must match Algorithm.key in DB.`);

      const before = await prisma.machine.findUnique({ where: { slug } });

      if (!before) {
        const created = await prisma.machine.create({
          data: {
            name,
            slug,
            manufacturer,
            algorithmId: algo.id,
            hashrate,
            hashrateUnit,
            powerW,
            efficiency,
            efficiencyUnit,
            releaseDate,
            status,
          },
        });

        await writeAuditLog({
          actorUserId: userId,
          action: AuditAction.CREATE,
          entity: "Machine",
          entityId: created.id,
          before: null,
          after: created,
        });

        createdCount++;
      } else {
        const after = await prisma.machine.update({
          where: { id: before.id },
          data: {
            name,
            manufacturer,
            algorithmId: algo.id,
            hashrate,
            hashrateUnit,
            powerW,
            efficiency,
            efficiencyUnit,
            releaseDate,
            status,
          },
        });

        await writeAuditLog({
          actorUserId: userId,
          action: AuditAction.UPDATE,
          entity: "Machine",
          entityId: before.id,
          before,
          after,
        });

        updatedCount++;
      }
    } catch (e: any) {
      errors.push(`Row ${rowNum}: ${e?.message ?? String(e)}`);
    }
  }

  if (errors.length) {
    // show first 20 errors to keep message readable
    throw new Error(
      `CSV import finished with errors.\nCreated: ${createdCount}, Updated: ${updatedCount}\n\n` +
        errors.slice(0, 20).join("\n") +
        (errors.length > 20 ? `\n...and ${errors.length - 20} more.` : "")
    );
  }

  revalidatePath("/admin/machines");
}

export default async function MachinesAdminPage() {
  const { userId } = await requireAdmin(["admin", "editor", "viewer"]);

  const roleKeys = userId ? await getUserRoleKeys(userId) : [];
  const canEdit = roleKeys.includes("admin") || roleKeys.includes("editor");
  const canDelete = roleKeys.includes("admin");

  const [machines, algorithms] = await Promise.all([
    prisma.machine.findMany({
      orderBy: { createdAt: "desc" },
      include: { algorithm: true },
      take: 200,
    }),
    prisma.algorithm.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Machines</h1>
        <p className="mt-1 text-sm text-white/70">
          Catalog is the source of truth. Vendor prices are manual only.
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm text-white/60">
            You have <span className="font-medium text-white">viewer</span> access: read-only.
          </p>
        )}
      </div>

      {/* CSV Import (admin/editor) */}
      {canEdit && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">Import machines (CSV)</h2>
          <p className="mt-1 text-xs text-white/60">
            Upload a CSV with headers:
            <span className="ml-2 font-mono text-white/70">
              name,slug,algorithmKey,hashrate,hashrateUnit,powerW,status,manufacturer,releaseDate,efficiency,efficiencyUnit
            </span>
          </p>

          <form action={importMachinesCsv} className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              className="block w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"
              required
            />
            <button className="h-10 rounded-xl bg-white px-5 font-semibold text-black hover:opacity-90">
              Import CSV
            </button>
          </form>

          <p className="mt-2 text-xs text-white/50">
            Import will CREATE by slug if not exists, otherwise UPDATE the existing machine with that slug.
          </p>
        </section>
      )}

      {/* Create machine (admin/editor) */}
      {canEdit && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">Create machine</h2>

          <form action={createMachine} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              name="name"
              placeholder="Name (e.g., Antminer S21)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              required
            />
            <input
              name="slug"
              placeholder="Slug (e.g., antminer-s21)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              required
            />

            <input
              name="manufacturer"
              placeholder="Manufacturer (optional)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
            />

            <select
              name="algorithmId"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              required
              defaultValue={algorithms[0]?.id ?? ""}
            >
              {algorithms.length === 0 ? (
                <option value="">No algorithms found (seed first)</option>
              ) : (
                algorithms.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.key})
                  </option>
                ))
              )}
            </select>

            <input
              name="hashrate"
              placeholder='Hashrate (e.g. "200")'
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              required
            />
            <input
              name="hashrateUnit"
              placeholder="Hashrate unit (e.g., TH/s)"
              defaultValue="TH/s"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              required
            />

            <input
              name="powerW"
              type="number"
              placeholder="Power (W) e.g. 3500"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              required
            />

            <input
              name="releaseDate"
              type="date"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
            />

            <input
              name="efficiency"
              placeholder='Efficiency (optional, e.g. "17.5")'
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
            />
            <input
              name="efficiencyUnit"
              placeholder='Efficiency unit (optional, e.g. "J/TH")'
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
            />

            <select
              name="status"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              defaultValue="AVAILABLE"
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="COMING_SOON">COMING_SOON</option>
              <option value="DISCONTINUED">DISCONTINUED</option>
            </select>

            <button className="rounded-xl bg-white py-2 font-medium text-black hover:opacity-90 md:col-span-2">
              Create
            </button>
          </form>

          {algorithms.length === 0 && (
            <p className="mt-3 text-xs text-yellow-200/80">
              No algorithms exist. Run your seed or create algorithms first.
            </p>
          )}
        </section>
      )}

      {/* Machines list */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Latest machines</h2>
        <p className="mt-1 text-xs text-white/50">
          Inline edit + Update (editor/admin). Delete is admin-only and blocked if machine has offerings.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1400px] w-full text-sm">
            <thead className="text-left text-white/70">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2 pr-3">Manufacturer</th>
                <th className="py-2 pr-3">Algorithm</th>
                <th className="py-2 pr-3">Hashrate</th>
                <th className="py-2 pr-3">Power</th>
                <th className="py-2 pr-3">Efficiency</th>
                <th className="py-2 pr-3">Release</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {machines.map((m) => (
                <tr key={m.id} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <input
                        name={`name_${m.id}`}
                        defaultValue={m.name}
                        form={`edit-${m.id}`}
                        className="h-9 w-[240px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                        required
                      />
                    ) : (
                      <div className="w-[240px]">{m.name}</div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <input
                        name={`slug_${m.id}`}
                        defaultValue={m.slug}
                        form={`edit-${m.id}`}
                        className="h-9 w-[220px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                        required
                      />
                    ) : (
                      <div className="w-[220px] text-white/70">{m.slug}</div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <input
                        name={`manufacturer_${m.id}`}
                        defaultValue={m.manufacturer ?? ""}
                        form={`edit-${m.id}`}
                        className="h-9 w-[220px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                        placeholder="—"
                      />
                    ) : (
                      <div className="w-[220px] text-white/70">{m.manufacturer ?? "—"}</div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <select
                        name={`algorithmId_${m.id}`}
                        defaultValue={m.algorithmId}
                        form={`edit-${m.id}`}
                        className="h-9 w-[220px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                        required
                      >
                        {algorithms.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.key})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-[220px]">{m.algorithm.name}</div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <input
                          name={`hashrate_${m.id}`}
                          defaultValue={m.hashrate}
                          form={`edit-${m.id}`}
                          className="h-9 w-[120px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                          required
                        />
                        <input
                          name={`hashrateUnit_${m.id}`}
                          defaultValue={m.hashrateUnit}
                          form={`edit-${m.id}`}
                          className="h-9 w-[90px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        {m.hashrate} {m.hashrateUnit}
                      </div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <input
                        name={`powerW_${m.id}`}
                        type="number"
                        defaultValue={m.powerW}
                        form={`edit-${m.id}`}
                        className="h-9 w-[120px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                        required
                      />
                    ) : (
                      <div className="w-[120px]">{m.powerW} W</div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <input
                          name={`efficiency_${m.id}`}
                          defaultValue={m.efficiency ?? ""}
                          form={`edit-${m.id}`}
                          className="h-9 w-[90px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                          placeholder="—"
                        />
                        <input
                          name={`efficiencyUnit_${m.id}`}
                          defaultValue={m.efficiencyUnit ?? ""}
                          form={`edit-${m.id}`}
                          className="h-9 w-[90px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                          placeholder="J/TH"
                        />
                      </div>
                    ) : (
                      <div className="w-[180px] text-white/70">
                        {m.efficiency ? `${m.efficiency} ${m.efficiencyUnit ?? ""}` : "—"}
                      </div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <input
                        name={`releaseDate_${m.id}`}
                        type="date"
                        defaultValue={m.releaseDate ? m.releaseDate.toISOString().slice(0, 10) : ""}
                        form={`edit-${m.id}`}
                        className="h-9 w-[160px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                      />
                    ) : (
                      <div className="w-[160px] text-white/70">
                        {m.releaseDate ? m.releaseDate.toISOString().slice(0, 10) : "—"}
                      </div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <select
                        name={`status_${m.id}`}
                        defaultValue={m.status}
                        form={`edit-${m.id}`}
                        className="h-9 w-[170px] rounded-xl border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-white/30"
                      >
                        <option value="AVAILABLE">AVAILABLE</option>
                        <option value="COMING_SOON">COMING_SOON</option>
                        <option value="DISCONTINUED">DISCONTINUED</option>
                      </select>
                    ) : (
                      <div className="w-[170px]">{m.status}</div>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <form
                        id={`edit-${m.id}`}
                        action={async (fd) => {
                          "use server";
                          const form = new FormData();
                          form.set("id", m.id);
                          form.set("name", String(fd.get(`name_${m.id}`) ?? ""));
                          form.set("slug", String(fd.get(`slug_${m.id}`) ?? ""));
                          form.set("manufacturer", String(fd.get(`manufacturer_${m.id}`) ?? ""));
                          form.set("algorithmId", String(fd.get(`algorithmId_${m.id}`) ?? ""));
                          form.set("hashrate", String(fd.get(`hashrate_${m.id}`) ?? ""));
                          form.set("hashrateUnit", String(fd.get(`hashrateUnit_${m.id}`) ?? ""));
                          form.set("powerW", String(fd.get(`powerW_${m.id}`) ?? "0"));
                          form.set("efficiency", String(fd.get(`efficiency_${m.id}`) ?? ""));
                          form.set("efficiencyUnit", String(fd.get(`efficiencyUnit_${m.id}`) ?? ""));
                          form.set("releaseDate", String(fd.get(`releaseDate_${m.id}`) ?? ""));
                          form.set("status", String(fd.get(`status_${m.id}`) ?? "AVAILABLE"));
                          await updateMachine(form);
                        }}
                        className="flex items-center gap-2"
                      >
                        <button className="h-9 rounded-xl bg-white px-4 font-semibold text-black hover:opacity-90">
                          Update
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-white/40">—</span>
                    )}

                    {canDelete && (
                      <form action={deleteMachine} className="mt-2">
                        <input type="hidden" name="id" value={m.id} />
                        <button className="h-9 w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 font-semibold text-red-200 hover:bg-red-500/15">
                          Delete
                        </button>
                      </form>
                    )}

                    {!canDelete && canEdit && (
                      <p className="mt-2 text-[11px] text-white/40">Delete is admin-only.</p>
                    )}
                  </td>
                </tr>
              ))}

              {machines.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-white/60">
                    No machines yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-white/50">
          Machine updates create AuditLog rows (CREATE/UPDATE/DELETE). CSV import creates CREATE/UPDATE logs per row.
        </p>
      </section>
    </div>
  );
}
