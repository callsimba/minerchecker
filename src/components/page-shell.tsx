import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow)]">
        {/* Accent strip (CSS vars store RGB triplets, so wrap with rgb()) */}
        <div className="absolute inset-x-0 top-0 h-1 bg-[rgb(var(--accent-yellow)/0.70)]" />

        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{subtitle}</p>
      </header>

      {children ? (
        children
      ) : (
        <section className="relative rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">What to expect</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {/* Card 1 */}
            <div
              className="group rounded-xl border border-border bg-bg p-4 transition
              hover:-translate-y-1 hover:border-[rgb(var(--accent-yellow)/0.50)]
              hover:shadow-[0_8px_30px_rgba(245,200,66,0.15)]"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent-yellow))]" />
                <div className="text-sm font-semibold">Practical guidance</div>
              </div>
              <p className="mt-1 text-sm text-muted">
                Clear, technical explanations designed for real buying and operating decisions.
              </p>
            </div>

            {/* Card 2 */}
            <div
              className="group rounded-xl border border-border bg-bg p-4 transition
              hover:-translate-y-1 hover:border-[rgb(var(--accent-yellow)/0.50)]
              hover:shadow-[0_8px_30px_rgba(245,200,66,0.15)]"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent-yellow))]" />
                <div className="text-sm font-semibold">Reference data</div>
              </div>
              <p className="mt-1 text-sm text-muted">
                Structured content blocks that will expand into live datasets over time.
              </p>
            </div>

            {/* Card 3 */}
            <div
              className="group rounded-xl border border-border bg-bg p-4 transition
              hover:-translate-y-1 hover:border-[rgb(var(--accent-yellow)/0.50)]
              hover:shadow-[0_8px_30px_rgba(245,200,66,0.15)]"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent-yellow))]" />
                <div className="text-sm font-semibold">Roadmap-ready</div>
              </div>
              <p className="mt-1 text-sm text-muted">
                Built to evolve into interactive tools (filters, charts, comparisons).
              </p>
            </div>
          </div>

          {/* Status box */}
          <div
            className="mt-6 rounded-xl border border-border bg-bg p-4
            ring-1 ring-[rgb(var(--accent-yellow)/0.25)]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[rgb(var(--accent-yellow))]" />
              <div className="text-sm font-semibold">Status</div>
            </div>
            <p className="mt-1 text-sm text-muted">
              This section is intentionally lightweight today. It’s wired to the site theme and layout and will be expanded with real data.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
