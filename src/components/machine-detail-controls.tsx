"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function clampElectricity(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const clamped = Math.min(Math.max(n, 0), 5);
  return String(clamped);
}

export function MachineDetailControls() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // IMPORTANT: use a stable string snapshot, NOT the sp object in deps
  const spString = sp.toString();

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

  // Keep UI in sync if user changes URL externally (back/forward or links)
  useEffect(() => {
    const c = (sp.get("currency") ?? "USD").toUpperCase();
    const r = (sp.get("region") ?? "GLOBAL").toUpperCase();
    const e = sp.get("electricity") ?? "0.10";

    // only update if actually different (prevents cursor-jank while typing)
    setCurrency((prev) => (prev === c ? prev : c));
    setRegion((prev) => (prev === r ? prev : r));
    setElectricity((prev) => (prev === e ? prev : e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spString]);

  // Avoid running replace() on first mount
  const didMount = useRef(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent replace loops by remembering the last URL we set
  const lastAppliedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    if (t.current) clearTimeout(t.current);

    t.current = setTimeout(() => {
      const next = new URLSearchParams(spString);

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
      const targetUrl = qs ? `${pathname}?${qs}` : pathname;

      // ✅ If the URL is already the same, do nothing (stops constant updates)
      const currentUrl = spString ? `${pathname}?${spString}` : pathname;

      if (targetUrl === currentUrl) return;
      if (lastAppliedUrl.current === targetUrl) return;

      lastAppliedUrl.current = targetUrl;
      router.replace(targetUrl, { scroll: false });
    }, 300);

    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, [currency, region, electricity, pathname, router, spString]);

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
        Updates URL params with a debounce. Electricity is a rate in{" "}
        <span className="font-mono">USD/kWh</span>.
      </p>
    </section>
  );
}
