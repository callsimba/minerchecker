"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type CoinLogo = {
  key: string;
  symbol: string;
  src: string;
};

export function CoinStrip({
  coins,
  selectedSymbol,
}: {
  coins: CoinLogo[];
  selectedSymbol?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setCoin(symbol?: string) {
    const next = new URLSearchParams(sp.toString());

    if (!symbol) next.delete("coin");
    else next.set("coin", symbol);

    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const selected = (selectedSymbol ?? "").toUpperCase();

  return (
    <section className="rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Filter by coin</div>

        {selected ? (
          <button
            type="button"
            onClick={() => setCoin(undefined)}
            className="text-xs font-semibold underline decoration-[rgb(var(--accent-yellow)/0.35)]
              hover:decoration-[rgb(var(--accent-yellow)/0.75)]"
          >
            Clear
          </button>
        ) : (
          <span className="text-xs text-muted">Tap a logo</span>
        )}
      </div>

      {/* NO SCROLLER: wrap all logos */}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* All */}
        <button
          type="button"
          onClick={() => setCoin(undefined)}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition
            ${
              !selected
                ? "border-[rgb(var(--accent-yellow)/0.60)] bg-[rgb(var(--accent-yellow)/0.12)]"
                : "border-border bg-bg hover:border-[rgb(var(--accent-yellow)/0.45)]"
            }`}
        >
          All
        </button>

        {coins.map((c) => {
          const isActive = selected === c.symbol;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCoin(c.symbol)}
              title={c.symbol}
              aria-label={`Filter by ${c.symbol}`}
              className={`rounded-xl border bg-bg p-1.5 transition
                hover:-translate-y-[1px] hover:border-[rgb(var(--accent-yellow)/0.45)]
                ${
                  isActive
                    ? "border-[rgb(var(--accent-yellow)/0.65)] ring-2 ring-[rgb(var(--accent-yellow)/0.18)]"
                    : "border-border"
                }`}
            >
              <img
                src={c.src}
                alt={c.symbol}
                width={36}
                height={36}
                className="h-9 w-9 rounded-md"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted">
        Click a coin to show only miners that can mine it.
      </p>
    </section>
  );
}
