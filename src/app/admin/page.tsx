import Link from "next/link";
import { auth } from "@/server/auth";

function AdminCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10 hover:border-white/20"
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-white/70">{desc}</div>
      <div className="mt-4 text-sm font-semibold text-white/80">
        Open <span className="opacity-70">→</span>
      </div>
    </Link>
  );
}

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminCard
          href="/admin/machines"
          title="Machines"
          desc="Manage miner specs, status, release dates."
        />
        <AdminCard
          href="/admin/vendors"
          title="Vendors"
          desc="Verify vendors, set trust levels."
        />
        <AdminCard
          href="/admin/offerings"
          title="Offerings"
          desc="Manual prices and product links."
        />
        <AdminCard
          href="/admin/events"
          title="Mining Events"
          desc="Create/edit conferences, launches, network events."
        />
      </div>
    </div>
  );
}
