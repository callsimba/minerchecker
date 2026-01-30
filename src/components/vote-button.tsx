"use client";

import { useEffect, useState } from "react";

type Vote = "up" | "down" | null;

function storageKey(machineId: string) {
  return `minerchecker:vote:${machineId}`;
}

export function VoteButton({ machineId }: { machineId: string }) {
  const [vote, setVote] = useState<Vote>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(machineId));
      setVote(saved === "up" || saved === "down" ? saved : null);
    } catch {}
  }, [machineId]);

  function set(next: Vote) {
    setVote(next);

    try {
      if (next) localStorage.setItem(storageKey(machineId), next);
      else localStorage.removeItem(storageKey(machineId));
    } catch {}

    setToast(
      next === "up"
        ? "🔥 Hot vote!"
        : next === "down"
        ? "🥶 Cold vote!"
        : "🫥 Vote removed"
    );
    setTimeout(() => setToast(null), 900);
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={() => set(vote === "up" ? null : "up")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition-all border ${
          vote === "up"
            ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
            : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
        }`}
        title="Vote Hot"
      >
        👍 <span>Hot</span>
      </button>

      <button
        onClick={() => set(vote === "down" ? null : "down")}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition-all border ${
          vote === "down"
            ? "bg-red-500/10 border-red-500/50 text-red-300"
            : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
        }`}
        title="Vote Cold"
      >
        👎 <span>Cold</span>
      </button>

      {toast && (
        <div className="absolute -bottom-9 left-0 whitespace-nowrap text-[11px] px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white">
          {toast}
        </div>
      )}
    </div>
  );
}