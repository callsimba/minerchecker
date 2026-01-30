"use client";

import * as React from "react";
import Link from "next/link";
import { deleteMachineAction, type DeleteMachineState } from "@/server/actions/machines";

const INITIAL_STATE: DeleteMachineState = { ok: true };

export function DeleteMachineButton({
  machineId,
  offeringsCount,
}: {
  machineId: string;
  offeringsCount: number;
}) {
  const [state, formAction, isPending] = React.useActionState(
    deleteMachineAction,
    INITIAL_STATE
  );

  const disabled = isPending || offeringsCount > 0;

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={machineId} />
        <button
          disabled={disabled}
          className={
            "h-9 w-full rounded-xl border px-4 font-semibold transition " +
            (disabled
              ? "border-red-500/25 bg-red-500/5 text-red-200/60 cursor-not-allowed"
              : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/15")
          }
          title={offeringsCount > 0 ? "Delete blocked: offerings exist" : "Delete machine"}
        >
          {isPending ? "Deleting…" : "Delete"}
        </button>
      </form>

      {offeringsCount > 0 ? (
        <p className="text-[11px] text-white/60">
          Has <span className="font-semibold">{offeringsCount}</span> offering(s).{" "}
          <Link
            href={`/admin/offerings?machineId=${encodeURIComponent(machineId)}`}
            className="underline decoration-white/20 hover:decoration-white/50"
          >
            View offerings
          </Link>
        </p>
      ) : null}

      {state.message ? (
        <p
          className={
            "text-[11px] " +
            (state.ok ? "text-emerald-300/80" : "text-red-200/80")
          }
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
