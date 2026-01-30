"use client";

import React, { useState } from "react";

export default function DeleteButton({
  onDelete,
  label = "Delete",
}: {
  onDelete: () => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        const ok = confirm("Delete this event? This cannot be undone.");
        if (!ok) return;
        setBusy(true);
        try {
          await onDelete();
        } finally {
          setBusy(false);
        }
      }}
      className="h-11 rounded-2xl px-4 font-semibold text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30"
    >
      {busy ? "Deleting..." : label}
    </button>
  );
}
