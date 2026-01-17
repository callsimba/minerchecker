"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function clampElectricity(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  // keep sane bounds, but don’t hard-block typing
  const clamped = Math.min(Math.max(n, 0), 5);
  return String(clamped);
}

export function MachineDetailControls() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const initial = useMemo(() => {
    const currency = (sp.get("currency") ?? "USD").toUpperCase();
    const region = (sp.get("region") ?? "GLOBAL").toUpperCase();
    const electricity = sp.get("electricity") ?? "0.10";
    return { currency, region, electricity };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currency, setCurrency] = useState(initial.currency);
  const [region, setRegion] = useState(initial.region);
  const [electricity, setElectricity] = useState(initial.electricity);

  // Avoid running replace() on first mount
  const didMount = useRef(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    if (t.current) clearTimeout(t.current);

    t.current = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());

      const c = currency.trim().toUpperCase();
      const r = region.trim().toUpperCase();
      const eRaw = electricity.trim();
      const e = eRaw.length ? clampElectricity(eRaw) : "";

      if (c) next.set("currency", c);
      else next.delete("currency");

      if (r) next.set("region", r);
      else next.delete("region");

      if (e) next.set("electricity", e);
      else next.delete("electricity");

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);

    return () => {
      if (t.current) clearTimeout(t.current);
    };
    // NOTE: include `sp` so we preserve other query params if they change elsewhere
  }, [currency, region, electricity, pathname, router, sp]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold">Controls</div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          {/* Region */}
          <label className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2">
            <span className="text-sm">🌍</span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Region (GLOBAL)"
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
              spellCheck={false}
            />
          </label>

          {/* Currency */}
          <label className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2">
            <span className="text-sm">💱</span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="Currency (USD)"
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
              spellCheck={false}
            />
          </label>

          {/* Electricity */}
          <label className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2">
            <span className="text-sm">⚡</span>
            <input
              value={electricity}
              onChange={(e) => setElectricity(e.target.value)}
              inputMode="decimal"
              placeholder="USD/kWh (0.10)"
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
            />
          </label>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Auto-updates URL params (no Apply button). Electricity is a rate in{" "}
        <span className="font-mono">USD/kWh</span> and cost/day is derived from machine{" "}
        <span className="font-mono">powerW</span>.
      </p>
    </section>
  );
}
