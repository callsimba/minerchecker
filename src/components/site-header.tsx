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
  document.cookie = `googtrans=/en/${lang}; path=/;`; // Fallback for localhost
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

    // 1. Define Init Function
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

    // 2. Add MutationObserver to remove the top bar DOM elements aggressively
    const observer = new MutationObserver(() => {
      // Force body top to 0 to prevent shifting
      if (document.body.style.top !== "0px") {
        document.body.style.top = "0px";
      }
      
      // Hide the banner frame if it exists
      const banner = document.querySelector(".goog-te-banner-frame");
      if (banner) {
        (banner as HTMLElement).style.display = "none";
      }
      
      // Hide the skiptranslate tooltip garbage
      const tooltips = document.querySelectorAll(".goog-tooltip");
      tooltips.forEach((el) => ((el as HTMLElement).style.display = "none"));
    });

    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  // --- Sync Effects ---
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

  // --- Handlers ---
  const handleLanguageChange = (newLang: string) => {
    setLang(newLang);
    setGoogleCookie(newLang);
    window.location.reload(); // Reload forces the translation engine to re-read the cookie
  };

  const isLight = theme === "light";

  const NavItems = [
    ["/", "Dashboard"],
    ["/miners/asic-miners", "Miners"],
    ["/marketplace/trusted-vendors", "Vendors"],
    ["/resources/learning-hub", "Learning"],
    ["/support/faq", "Support"],
  ] as const;

  const Filters = (
    <div className="flex items-center gap-3 bg-[#151a2a] p-1.5 rounded-xl border border-white/5 shadow-sm">
      {/* Currency */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none text-slate-500 text-xs font-bold">$</div>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          className="h-8 pl-6 pr-8 bg-[#0b0e14] rounded-lg border border-white/5 text-xs font-bold text-slate-300 outline-none focus:border-orange-500/50 focus:text-orange-400 transition-colors appearance-none cursor-pointer hover:bg-black/40"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">▼</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Electricity */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none text-slate-500 text-xs">⚡</div>
        <input
          value={electricity}
          onChange={(e) => setElectricity(e.target.value)}
          inputMode="decimal"
          className="h-8 w-20 pl-7 pr-3 bg-[#0b0e14] rounded-lg border border-white/5 text-xs font-bold text-slate-300 outline-none focus:border-orange-500/50 focus:text-orange-400 placeholder:text-slate-700 transition-colors text-right"
          placeholder="0.10"
        />
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Language Selector */}
      <div className="relative group">
        <select
          value={lang}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="h-8 w-12 pl-2 pr-0 bg-[#0b0e14] rounded-lg border border-white/5 text-lg outline-none cursor-pointer appearance-none text-center hover:bg-black/40 transition-colors focus:border-orange-500/30"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag}
            </option>
          ))}
        </select>
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black border border-white/10 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
          {LANGUAGES.find((l) => l.code === lang)?.label}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />

      {/* AGGRESSIVE CSS OVERRIDES */}
      <style jsx global>{`
        /* Hide the Google Banner Frame */
        .goog-te-banner-frame {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
        }
        /* Force body back to top */
        body {
          top: 0px !important;
          position: static !important;
        }
        /* Hide the widget itself */
        #google_translate_element {
          display: none !important;
        }
        /* Hide tooltips */
        .goog-tooltip, .goog-tooltip:hover {
          display: none !important;
        }
        /* Remove blue hover highlights on text */
        .goog-text-highlight {
          background-color: transparent !important;
          box-shadow: none !important;
        }
        /* Fix fonts */
        font {
          background-color: transparent !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* Invisible target div for the script */}
      <div id="google_translate_element" style={{ display: "none" }} />

      <header className="relative z-50 bg-[#0b0e14] border-b border-white/5">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <div className="flex h-20 items-center justify-between gap-6">
            
            {/* Left */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-orange-400 text-white font-black text-sm tracking-tighter shadow-lg shadow-orange-900/20 group-hover:scale-105 transition-transform">
                  MC
                  <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white leading-none tracking-tight">MinerChecker</span>
                  <span className="text-[10px] text-slate-500 font-medium tracking-wide">PRO ANALYTICS</span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                {NavItems.map(([href, label]) => {
                  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "text-white bg-white/5 shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset]"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right */}
            <div className="hidden md:flex items-center gap-4">
              {Filters}
              <div className="h-6 w-px bg-white/10" />
              <button
                onClick={() => setTheme(isLight ? "dark" : "light")}
                className="group flex h-9 w-9 items-center justify-center rounded-xl bg-[#151a2a] border border-white/5 text-slate-400 hover:text-orange-400 hover:border-orange-500/30 transition-all"
              >
                {isLight ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </button>
            </div>

            {/* Mobile Toggle */}
            <button
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-[#151a2a] border border-white/5 text-slate-300"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#0b0e14] px-4 py-6 space-y-6 animate-in slide-in-from-top-2">
            <nav className="flex flex-col gap-2">
              {NavItems.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname === href
                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="pt-6 border-t border-white/5 space-y-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Settings</div>
              <div className="flex flex-col gap-4">
                {Filters}
                <button
                  onClick={() => setTheme(isLight ? "dark" : "light")}
                  className="flex w-full items-center justify-between px-4 py-3 rounded-xl bg-[#151a2a] border border-white/5 text-slate-300"
                >
                  <span>Theme</span>
                  {isLight ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}