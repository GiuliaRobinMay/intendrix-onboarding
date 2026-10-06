"use client";

// When the app cannot reach the database it falls back to a built-in
// demo set — five sample clients, so the screens have something to
// draw. That fallback is useful and nearly cost us a week: someone
// signed in, saw five clients that were not theirs, and reported a
// missing client rather than a missing account. Demo data must never
// again be mistaken for real data.
//
// So it says so, on every page, in red, and it does not go away.

import { TriangleAlert } from "lucide-react";
import { useData } from "@/lib/state";

export function DemoBanner() {
  const { backend } = useData();
  if (backend !== "browser") return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#eb320f]/70 bg-[#eb320f]/12 px-4 py-3">
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#ff7a55]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#ff7a55]">
          This is sample data, not your clients
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-mist">
          The app could not reach the shared database, so it is showing a
          built-in example. Nothing here is real and nothing you change is
          saved. The usual cause is an account without access — ask whoever
          runs Intendrix to check your invitation.
        </p>
      </div>
    </div>
  );
}
