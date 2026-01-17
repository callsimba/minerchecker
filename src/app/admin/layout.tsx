import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-semibold tracking-tight">
            MinerChecker Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/80">
            <Link className="hover:text-white" href="/admin/machines">
              Machines
            </Link>
            <Link className="hover:text-white" href="/admin/vendors">
              Vendors
            </Link>
            <Link className="hover:text-white" href="/admin/offerings">
              Offerings
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
