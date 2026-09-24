"use client";

// The sending engine went quiet for two weeks and the app looked
// perfectly normal the whole time. An engine that has stopped and an
// engine with nothing to do are indistinguishable from the outside, so
// the engine now leaves a heartbeat on every run and this says so out
// loud when it goes missing.
//
// A day and a half of silence is the threshold: the engine runs twice
// daily, so two missed days is already a real gap, and one missed run
// is not worth an alarm.

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { useData } from "@/lib/state";

const QUIET_HOURS = 36;

export function EngineBanner() {
  const { settings, backend } = useData();
  if (backend !== "database") return null;

  let last: { at?: string; off?: boolean } | null = null;
  try {
    last = settings.engineLastRun ? JSON.parse(settings.engineLastRun) : null;
  } catch {
    last = null;
  }

  // nothing recorded yet is not news: the heartbeat starts with the
  // first run after this arrives
  if (!last?.at) return null;

  const hours = (Date.now() - new Date(last.at).getTime()) / 3600000;
  if (hours < QUIET_HOURS && !last.off) return null;

  const days = Math.floor(hours / 24);
  const when =
    days >= 1 ? `${days} day${days === 1 ? "" : "s"}` : `${Math.round(hours)} hours`;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#eb320f]/60 bg-[#eb320f]/10 px-4 py-3">
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#ff7a55]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#ff7a55]">
          {last.off
            ? "Email sending is switched off"
            : `Nothing has been sent for ${when}`}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-mist">
          {last.off ? (
            <>
              The daily engine is running, but sending is off, so no lesson
              leaves the building.{" "}
              <Link href="/settings" className="font-semibold text-paper underline">
                Turn it on in Settings
              </Link>
              .
            </>
          ) : (
            <>
              The daily engine last ran{" "}
              {new Date(last.at).toLocaleString("en-US")}. It should run twice a
              day, so something is stopping it — check the scheduled jobs in the
              hosting dashboard. Lessons due in the meantime have not gone out.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
