"use client";

import { useEffect, useState } from "react";

type Vote = "up" | "down" | null;

function storageKey(machineId: string) {
  return `minerchecker:vote:${machineId}`;
}

export function MarketSentimentCard({ machineId, isProfit }: { machineId: string; isProfit: boolean | null }) {
  const [vote, setVote] = useState<Vote>(null);
  // Mock counts for visual demo (replace with real DB counts if available)
  const [upCount, setUpCount] = useState(124);
  const [downCount, setDownCount] = useState(32);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(machineId));
      if (saved === "up" || saved === "down") setVote(saved);
    } catch {}
  }, [machineId]);

  function handleVote(type: Vote) {
    const next = vote === type ? null : type;
    setVote(next);
    try {
      if (next) localStorage.setItem(storageKey(machineId), next);
      else localStorage.removeItem(storageKey(machineId));
    } catch {}

    // Optimistic UI update
    if (type === "up") {
        if (vote === "up") setUpCount(c => c - 1);
        else {
            setUpCount(c => c + 1);
            if (vote === "down") setDownCount(c => c - 1);
        }
    } else if (type === "down") {
        if (vote === "down") setDownCount(c => c - 1);
        else {
            setDownCount(c => c + 1);
            if (vote === "up") setUpCount(c => c - 1);
        }
    }
  }

  // Calculate rotation: 0..1 ratio mapped to -45deg..45deg
  const total = upCount + downCount || 1;
  const ratio = upCount / total;
  const rotation = -45 + ratio * 90;

  return (
    <div className="bg-[#151a2a] border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
      {/* Gauge Section */}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-8 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-red-900/40 via-slate-700/30 to-emerald-900/40 rounded-t-full border-t border-slate-700"></div>
          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 w-1 h-[90%] bg-white origin-bottom transition-transform duration-500 ease-out z-10 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          />
          <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-white rounded-full -translate-x-1/2 translate-y-1/2 z-20" />
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Sentiment</div>
          <div className={`text-sm font-bold ${ratio > 0.5 ? "text-emerald-400" : "text-red-400"}`}>
            {ratio > 0.5 ? "Bullish" : "Bearish"}
            <span className="text-slate-500 text-xs font-normal ml-1">
              {Math.round(ratio * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Vote Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleVote("down")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold uppercase tracking-wide ${
            vote === "down"
              ? "bg-red-900/30 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-400"
          }`}
        >
          <span>📉</span>
          <span>{downCount}</span>
        </button>

        <button
          onClick={() => handleVote("up")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold uppercase tracking-wide ${
            vote === "up"
              ? "bg-emerald-900/30 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400"
          }`}
        >
          <span>🚀</span>
          <span>{upCount}</span>
        </button>
      </div>
    </div>
  );
}