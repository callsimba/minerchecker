import { auth } from "@/server/auth";

export default async function AdminHome() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-white/70 text-sm">
          Signed in as: <span className="text-white">{session?.user?.email}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <a className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10" href="/admin/machines">
          <div className="font-semibold">Machines</div>
          <div className="mt-1 text-sm text-white/70">Manage miner specs, status, release dates.</div>
        </a>
        <a className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10" href="/admin/vendors">
          <div className="font-semibold">Vendors</div>
          <div className="mt-1 text-sm text-white/70">Verify vendors, set trust levels.</div>
        </a>
        <a className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10" href="/admin/offerings">
          <div className="font-semibold">Offerings</div>
          <div className="mt-1 text-sm text-white/70">Manual prices and product links.</div>
        </a>
      </div>
    </div>
  );
}
