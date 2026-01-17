"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

function getStored(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return v && v.trim().length ? v : fallback;
}

function setStored(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.64 5.64 4.22 4.22M19.78 19.78l-1.42-1.42M18.36 5.64l1.42-1.42M4.22 19.78l1.42-1.42"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M21 13.2A7.7 7.7 0 0 1 10.8 3 8.8 8.8 0 1 0 21 13.2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  const [currency, setCurrency] = useState("USD");
  const [electricity, setElectricity] = useState("0.10");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load persisted preferences
  useEffect(() => {
    setCurrency(getStored("mc_currency", "USD").toUpperCase());
    setElectricity(getStored("mc_electricity", "0.10"));
    const t = getStored("mc_theme", "dark") as any;
    setTheme(t === "light" ? "light" : "dark");
  }, []);

  // Theme sync (dark default; add .light when light)
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    setStored("mc_theme", theme);
  }, [theme]);

  // Store preferences ONLY. No URL updates here.
  useEffect(() => {
    setStored("mc_currency", currency);
    setStored("mc_electricity", electricity);
  }, [currency, electricity]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isLight = theme === "light";

  const NavItems = [
    ["/", "Dashboard", "🏠"],
    ["/miners/asic-miners", "ASIC Miners", "⛏️"],
    ["/marketplace/trusted-vendors", "Vendors", "🛒"],
    ["/resources/learning-hub", "Learning", "📚"],
    ["/support/faq", "Support", "💬"],
  ] as const;

  const Filters = (
    <div className="flex items-center gap-2">
      {/* Currency */}
      <div
        title="Currency"
        className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2"
      >
        <span className="text-base leading-none">💱</span>
        <div className="relative">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            className="h-9 w-[108px] appearance-none rounded-xl border border-border bg-bg px-3 pr-8
            text-sm font-semibold text-fg outline-none
            focus:border-[rgb(var(--accent-yellow)/0.55)] focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-bg text-fg">
                {c}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted">
            ▾
          </span>
        </div>
      </div>

      {/* Electricity */}
      <div
        title="Electricity ($/kWh)"
        className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2"
      >
        <span className="text-base leading-none">⚡</span>
        <input
          value={electricity}
          onChange={(e) => setElectricity(e.target.value)}
          inputMode="decimal"
          className="h-9 w-[92px] rounded-xl border border-border bg-bg px-3 text-right
          text-sm font-semibold text-fg outline-none
          placeholder:text-muted/70
          focus:border-[rgb(var(--accent-yellow)/0.55)] focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]"
          placeholder="0.10"
          aria-label="Electricity cost per kWh"
        />
      </div>
    </div>
  );

  const DesktopNav = (
    <nav className="flex items-center gap-2">
      {/* Always visible */}
      {NavItems.map(([href, label, icon], idx) => {
        // progressively hide items so no overflow ever happens
        // Keep the most important visible at smaller widths.
        const cls =
          idx === 3
            ? "hidden xl:inline-flex" // Learning hides first
            : idx === 4
            ? "hidden lg:inline-flex" // Support hides next
            : "inline-flex";

        return (
          <Link
            key={href}
            href={href}
            className={`${cls} items-center gap-2 whitespace-nowrap rounded-2xl border border-border bg-card px-3 py-2
            text-sm font-semibold text-fg
            transition hover:-translate-y-[1px] hover:border-[rgb(var(--accent-yellow)/0.35)]
            focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]`}
          >
            <span className="text-base leading-none">{icon}</span>
            <span className="hidden 2xl:inline">{label}</span>
            <span className="2xl:hidden">{label === "ASIC Miners" ? "Miners" : label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* Desktop single-row header */}
        <div className="hidden md:grid grid-cols-[auto_auto_1fr_auto] items-center gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-2xl bg-card
              ring-1 ring-[rgb(var(--accent-yellow)/0.35)] shadow-[var(--shadow)]"
            >
              <span className="text-sm font-semibold">MC</span>
            </div>
            <span className="text-sm font-semibold text-fg">MinerChecker</span>
          </Link>

          {/* Filters */}
          {Filters}

          {/* Nav fills remaining space but never scrolls; items hide instead */}
          <div className="flex justify-center">{DesktopNav}</div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(isLight ? "dark" : "light")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-fg
            shadow-[var(--shadow)] transition hover:-translate-y-[1px] hover:border-[rgb(var(--accent-yellow)/0.40)]
            focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.25)]"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {isLight ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile top bar */}
        <div className="flex md:hidden items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-2xl bg-card
              ring-1 ring-[rgb(var(--accent-yellow)/0.35)] shadow-[var(--shadow)]"
            >
              <span className="text-sm font-semibold">MC</span>
            </div>
            <span className="text-sm font-semibold text-fg">MinerChecker</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(isLight ? "dark" : "light")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-fg
              shadow-[var(--shadow)] transition hover:border-[rgb(var(--accent-yellow)/0.40)]
              focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.25)]"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isLight ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-fg
              shadow-[var(--shadow)] transition hover:border-[rgb(var(--accent-yellow)/0.40)]
              focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.25)]"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile: collapsible menu */}
        {mobileOpen && (
          <div className="md:hidden mt-3 rounded-2xl border border-border bg-card shadow-[var(--shadow)] overflow-hidden">
            <div className="h-1 w-full bg-[rgb(var(--accent-yellow)/0.55)]" />
            <div className="space-y-3 p-3">
              {Filters}
              <div className="flex flex-wrap gap-2">
                {NavItems.map(([href, label, icon]) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border border-border bg-bg px-3 py-2
                    text-sm font-semibold text-fg
                    transition hover:border-[rgb(var(--accent-yellow)/0.35)]
                    focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-yellow)/0.20)]"
                  >
                    <span className="text-base leading-none">{icon}</span>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--accent-red)/0.22)] to-transparent" />
      </div>
    </header>
  );
}
