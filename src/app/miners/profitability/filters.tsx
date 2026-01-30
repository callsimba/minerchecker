"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type FiltersProps = {
  algorithms: { key: string; name: string }[];
  locations: string[];
  currencies: string[];
};

export function ProfitabilityFilters({ algorithms, locations, currencies }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Current values (with defaults)
  const currency = searchParams.get("currency") ?? "USD";
  const region = searchParams.get("region") ?? "GLOBAL";
  const algorithm = searchParams.get("algorithm") ?? "";
  const sort = searchParams.get("sort") ?? "profit";
  const profitable = searchParams.get("profitable") === "on";
  const offers = searchParams.get("offers") === "on";

  // Local electricity state (debounced push)
  const electricityParam = searchParams.get("electricity") ?? "0.10";
  const [electricity, setElectricity] = useState(electricityParam);

  // Keep local state in sync if URL changes externally
  useEffect(() => {
    setElectricity(electricityParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electricityParam]);

  // Helper: update params smoothly (preserves everything else, including compare)
  function updateParam(key: string, value: string | boolean | number) {
    const params = new URLSearchParams(searchParams.toString());
    const v = String(value);

    if (v === "" || value === false) params.delete(key);
    else params.set(key, v);

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  function resetFilters() {
    const params = new URLSearchParams(searchParams.toString());
    // Keep compare if you want; remove these core filters
    ["algorithm", "profitable", "offers", "sort", "electricity", "currency", "region"].forEach((k) =>
      params.delete(k)
    );
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  // Debounce electricity -> URL
  useEffect(() => {
    const t = setTimeout(() => {
      // Guard invalid input
      const n = Number(electricity);
      if (!Number.isFinite(n) || n <= 0) return;
      updateParam("electricity", n.toFixed(2));
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electricity]);

  const presets = useMemo(() => ["0.05", "0.10", "0.15", "0.20", "0.30"], []);

  return (
    <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center gap-4">
        {/* Region & Currency */}
        <div className="flex gap-2">
          <select
            value={region}
            onChange={(e) => updateParam("region", e.target.value)}
            className="h-10 px-3 bg-[#0b0e14] border border-slate-700 rounded-lg text-sm text-white font-bold outline-none cursor-pointer hover:border-slate-500 transition-colors"
          >
            {locations.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={currency}
            onChange={(e) => updateParam("currency", e.target.value)}
            className="h-10 px-3 bg-[#0b0e14] border border-slate-700 rounded-lg text-sm text-white font-bold outline-none cursor-pointer hover:border-slate-500 transition-colors"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="h-8 w-px bg-white/10 hidden sm:block" />

        {/* Electricity Slider & Input */}
        <div className="flex items-center gap-3 bg-[#0b0e14] px-4 py-2 rounded-lg border border-slate-700">
          <span className="text-xs text-orange-400 font-bold">⚡ ELEC</span>

          <div className="flex flex-col w-32">
            <input
              type="range"
              min="0.01"
              max="0.40"
              step="0.01"
              value={electricity}
              onChange={(e) => setElectricity(e.target.value)}
              className="accent-orange-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex gap-1 mt-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setElectricity(p)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    electricity === p
                      ? "border-orange-500/40 text-orange-300 bg-orange-500/10"
                      : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <input
              value={electricity}
              onChange={(e) => setElectricity(e.target.value)}
              className="w-12 bg-transparent text-sm text-white text-right font-mono font-bold outline-none"
              inputMode="decimal"
            />
            <span className="text-xs text-slate-500">$/kWh</span>
          </div>
        </div>

        <div className="h-8 w-px bg-white/10 hidden md:block" />

        {/* Algorithm */}
        <select
          value={algorithm}
          onChange={(e) => updateParam("algorithm", e.target.value)}
          className="h-10 px-3 bg-[#0b0e14] border border-slate-700 rounded-lg text-sm text-slate-300 outline-none cursor-pointer max-w-[160px]"
        >
          <option value="">All Algos</option>
          {algorithms.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="h-10 px-3 bg-[#0b0e14] border border-slate-700 rounded-lg text-sm text-orange-300 font-bold outline-none cursor-pointer"
        >
          <option value="profit">Sort: Profit</option>
          <option value="roi">Sort: ROI</option>
          <option value="efficiency">Sort: Efficiency</option>
          <option value="price">Sort: Price</option>
        </select>

        {/* Toggles */}
        <div className="flex items-center gap-4 px-2">
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                profitable ? "bg-orange-500 border-orange-500" : "border-slate-600 bg-slate-800"
              }`}
            >
              {profitable && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <input
              type="checkbox"
              checked={profitable}
              onChange={(e) => updateParam("profitable", e.target.checked ? "on" : "")}
              className="hidden"
            />
            <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">
              Profitable Only
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                offers ? "bg-orange-500 border-orange-500" : "border-slate-600 bg-slate-800"
              }`}
            >
              {offers && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <input
              type="checkbox"
              checked={offers}
              onChange={(e) => updateParam("offers", e.target.checked ? "on" : "")}
              className="hidden"
            />
            <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">
              Has Offers
            </span>
          </label>
        </div>

        {/* Reset + Pending */}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={resetFilters}
            className="h-10 px-4 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            title="Reset filters"
          >
            Reset ↺
          </button>

          {isPending && <div className="text-xs text-orange-400 animate-pulse font-bold">Updating...</div>}
        </div>
      </div>
    </div>
  );
}
