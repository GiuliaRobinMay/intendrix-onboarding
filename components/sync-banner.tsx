"use client";

// When a change does not reach the database, say so loudly. Silence
// here is the worst outcome: the screen keeps showing what you typed,
// so the app looks like it saved, and the value only disappears later
// when the page reloads — which reads as the app losing your work.
//
// The database's own words are shown, because the usual cause is a
// column a migration has not added yet, and that message names it.

import { useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import { useData } from "@/lib/state";

export function SyncBanner() {
  const { syncError } = useData();
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!syncError || dismissed === syncError) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[58] flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-2xl items-start gap-3 rounded-lg border border-[#eb320f]/60 bg-[#2a1410] px-4 py-3 shadow-2xl shadow-black/50">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#ff7a55]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#ff7a55]">
            That change was not saved
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-mist">
            What you see on screen has not reached the database, and it will be
            gone when this page reloads. The database said:{" "}
            <span className="font-mono text-[11px] text-paper">{syncError}</span>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 cursor-pointer rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-paper transition-colors hover:border-white/35"
          >
            Reload and see what is really stored
          </button>
        </div>
        <button
          data-tip="Hide this"
          onClick={() => setDismissed(syncError)}
          className="shrink-0 cursor-pointer rounded-md p-1 text-mist transition-colors hover:bg-white/10 hover:text-paper"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
