"use client";

import Script from "next/script";

export function ThemeInitScript() {
  const code = `
(function () {
  try {
    var stored = localStorage.getItem("mc_theme");
    var theme = stored || "dark";
    var root = document.documentElement;

    // DARK = default (no class), LIGHT = explicit override
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
  } catch (e) {}
})();`;

  return (
    <Script
      id="mc-theme-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}

export default ThemeInitScript;
