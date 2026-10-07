"use client";

// What the provider said when it turned a lesson back.
//
// A refused send used to look exactly like a send nobody ever made: the
// row read "Not sent" either way. The difference matters — one needs a
// decision, the other needs a fix — so the reason is printed where the
// lesson is, in the provider's own words.

import { AlertTriangle } from "lucide-react";

export function RefusedNote({
  failure,
}: {
  failure: { count: number; error: string | null };
}) {
  return (
    <div className="mt-3 rounded-lg border border-[#f87171]/35 bg-[#f87171]/10 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#f87171]">
        <AlertTriangle size={12} />
        Refused — {failure.count} email{failure.count === 1 ? "" : "s"} left and
        came straight back
      </p>
      {failure.error && (
        <p className="mt-1 font-mono text-[10px] leading-relaxed break-words text-mist">
          {failure.error}
        </p>
      )}
      <p className="mt-1.5 text-[11px] leading-relaxed text-mist">
        Nobody received it. Once the reason above is fixed, send it again —
        people who never got it are the only ones it goes to, so nothing
        arrives twice.
      </p>
    </div>
  );
}
