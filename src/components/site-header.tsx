"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh-CN', label: 'Chinese', flag: '🇨🇳' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷' },
  { code: 'tr', label: 'Turkish', flag: '🇹🇷' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
];

function getStored(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return v && v.trim().length ? v : fallback;
}

function setStored(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

// --- Icons ---
function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.64 5.64 4.22 4.22M19.78 19.78l-1.42-1.42M18.36 5.64l1.42-1.42M4.22 19.78l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M21 13.2A7.7 7.7 0 0 1 10.8 3 8.8 8.8 0 1 0 21 13.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// --- Cookie Helpers ---
function setGoogleCookie(lang: string) {
  const domain = window.location.hostname;
  document.cookie = `googtrans=/en/${lang}; path=/; domain=${domain}`;
  document.cookie = `googtrans=/en/${lang}; path=/;`; 
}

function getGoogleCookie() {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(^| )googtrans=([^;]+)/);
  if (match) {
    const val = match[2];
    const parts = val.split("/");
    return parts[2] || "en";
  }
  return "en";
}

export function SiteHeader() {
  const pathname = usePathname();

  const [currency, setCurrency] = useState("USD");
  const [electricity, setElectricity] = useState("0.10");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [lang, setLang] = useState("en");
  const [mobileOpen, setMobileOpen] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    setCurrency(getStored("mc_currency", "USD").toUpperCase());
    setElectricity(getStored("mc_electricity", "0.10"));
    const t = getStored("mc_theme", "dark") as any;
    setTheme(t === "light" ? "light" : "dark");
    setLang(getGoogleCookie());

    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: LANGUAGES.map((l) => l.code).join(","),
          autoDisplay: false,
        },
        "google_translate_element"
      );
    };

    const observer = new MutationObserver(() => {
      if (document.body.style.top !== "0px") {
        document.body.style.top = "0px";
      }
      const banner = document.querySelector(".goog-te-banner-frame");
      if (banner) (banner as HTMLElement).style.display = "none";
      const tooltips = document.querySelectorAll(".goog-tooltip");
      tooltips.forEach((el) => ((el as HTMLElement).style.display = "none"));
    });

    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    setStored("mc_theme", theme);
  }, [theme]);

  useEffect(() => {
    setStored("mc_currency", currency);
    setStored("mc_electricity", electricity);
  }, [currency, electricity]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLanguageChange = (newLang: string) => {
    setLang(newLang);
    setGoogleCookie(newLang);
    window.location.reload(); 
  };

  const isLight = theme === "light";

  const NavItems = [
    ["/", "Dashboard"],
    ["/miners/asic-miners", "Miners"],
    ["/marketplace/trusted-vendors", "Vendors"],
    ["/resources/learning-hub", "Learning"],
    ["/support/faq", "Support"],
  ] as const;

  const ControlPod = (
    <div className="flex items-center bg-black/20 rounded-xl border border-white/10 p-1">
      {/* Currency */}
      <div className="relative group px-1">
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          className="h-8 pl-2 pr-6 bg-transparent text-xs font-bold text-zinc-300 outline-none cursor-pointer appearance-none hover:text-white transition-colors"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c} className="bg-zinc-900">{c}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-zinc-600">▼</span>
      </div>

      <div className="w-px h-4 bg-white/10 mx-1" />

      {/* Electricity */}
      <div className="flex items-center gap-1 px-2">
        <span className="text-yellow-500 text-xs">⚡</span>
        <input
          value={electricity}
          onChange={(e) => setElectricity(e.target.value)}
          className="h-8 w-12 bg-transparent text-xs font-mono text-zinc-300 outline-none text-right focus:text-cyan-400 transition-colors placeholder:text-zinc-700"
          placeholder="0.10"
        />
        <span className="text-[10px] text-zinc-600 font-bold">/kWh</span>
      </div>

      <div className="w-px h-4 bg-white/10 mx-1" />

      {/* Language */}
      <div className="relative px-1">
        <select
          value={lang}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="h-8 w-8 bg-transparent text-lg outline-none cursor-pointer appearance-none text-center hover:opacity-80 transition-opacity"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="bg-zinc-900">
              {l.flag}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />

      <style jsx global>{`
        .goog-te-banner-frame { display: none !important; visibility: hidden !important; height: 0 !important; }
        body { top: 0px !important; position: static !important; }
        #google_translate_element { display: none !important; }
        .goog-tooltip { display: none !important; }
        .goog-text-highlight { background-color: transparent !important; box-shadow: none !important; }
        font { background-color: transparent !important; box-shadow: none !important; }
      `}</style>

      <div id="google_translate_element" style={{ display: "none" }} />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto max-w-[1450px] px-4 md:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            
            {/* Logo & Desktop Nav */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-black text-xs shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
                  MC
                  <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/20" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white leading-none tracking-tight group-hover:text-cyan-400 transition-colors">MinerChecker</span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                {NavItems.map(([href, label]) => {
                  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all relative ${
                        isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {label}
                      {isActive && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Controls */}
            <div className="hidden md:flex items-center gap-3">
              {ControlPod}
              <button
                onClick={() => setTheme(isLight ? "dark" : "light")}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/5 bg-black/20 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {isLight ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </button>
            </div>

            {/* Mobile Toggle */}
            <button
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/5 bg-zinc-950 px-4 py-6 space-y-6 animate-in slide-in-from-top-2">
            <nav className="flex flex-col gap-1">
              {NavItems.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname === href
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="pt-6 border-t border-white/5 space-y-4">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Settings</div>
              <div className="flex flex-col gap-3">
                {ControlPod}
                <button
                  onClick={() => setTheme(isLight ? "dark" : "light")}
                  className="flex w-full items-center justify-between px-4 py-3 rounded-xl bg-black/20 border border-white/5 text-zinc-300"
                >
                  <span>Theme</span>
                  {isLight ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      
      {/* Spacer to prevent content overlap with fixed header */}
      <div className="h-16" />
    </>
  );
}