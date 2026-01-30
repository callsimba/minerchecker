"use client";

import { useState, type ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type TabId = "desc" | "specs" | "coins";

export function MachinePageTabs({
  description,
  specs,
  coins,
}: {
  description: ReactNode;
  specs: ReactNode;
  coins: ReactNode;
}) {
  const [active, setActive] = useState<TabId>("desc");

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "desc", label: "Description" },
    { id: "specs", label: "Specifications" },
    { id: "coins", label: "Minable Coins" },
  ];

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Machine details tabs"
        className="flex items-center gap-8 border-b border-white/10 mb-6 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={cx(
                "pb-4 text-sm font-medium transition-colors relative outline-none whitespace-nowrap",
                isActive ? "text-orange-500" : "text-slate-400 hover:text-white"
              )}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-[200px] animate-in fade-in slide-in-from-bottom-2 duration-300">
        {active === "desc" && description}
        {active === "specs" && specs}
        {active === "coins" && coins}
      </div>
    </div>
  );
}