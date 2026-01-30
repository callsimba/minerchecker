"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "minerx:favorites:v1";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function FavoriteButton({
  machineId,
  className,
}: {
  machineId: string;
  className?: string;
}) {
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    setIsFav(readSet().has(machineId));
  }, [machineId]);

  const label = useMemo(() => (isFav ? "Saved" : "Save"), [isFav]);

  return (
    <button
      type="button"
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-2 text-sm font-semibold text-fg hover:bg-card"
      }
      aria-pressed={isFav}
      onClick={() => {
        const set = readSet();
        if (set.has(machineId)) set.delete(machineId);
        else set.add(machineId);
        writeSet(set);
        setIsFav(set.has(machineId));
      }}
      title={
        isFav
          ? "Saved to your local watchlist (this device)."
          : "Save to your local watchlist (this device)."
      }
    >
      <span aria-hidden>{isFav ? "⭐" : "☆"}</span>
      <span>{label}</span>
    </button>
  );
}
