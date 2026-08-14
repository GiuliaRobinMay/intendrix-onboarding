"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flag, MapPin, Rocket, Video } from "lucide-react";
import { PageHeader, Chip } from "@/components/ui";
import { useData } from "@/lib/state";
import { fmtDate } from "@/lib/store";

interface CalendarEvent {
  date: string; // ISO yyyy-mm-dd
  kind: "session" | "start" | "end";
  label: string;
  clientName: string;
  campaignName: string;
  campaignId: string;
  mode?: "virtual" | "in-person";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Stable colour per campaign, from the brand ramp. */
const CAMPAIGN_RAMP = ["#eb320f", "#a1348c", "#2c2d83", "#cf3352", "#6531a5"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { clients } = useData();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { events, campaignColor } = useMemo(() => {
    const events: CalendarEvent[] = [];
    const campaignColor = new Map<string, string>();
    let colorIdx = 0;
    for (const client of clients) {
      for (const campaign of client.campaigns) {
        if (!campaignColor.has(campaign.id)) {
          campaignColor.set(campaign.id, CAMPAIGN_RAMP[colorIdx++ % CAMPAIGN_RAMP.length]);
        }
        const base = {
          clientName: client.name,
          campaignName: `${campaign.code} · ${campaign.name}`,
          campaignId: campaign.id,
        };
        if (campaign.startDate) {
          events.push({ ...base, date: campaign.startDate, kind: "start", label: "Campaign start" });
        }
        if (campaign.endDate) {
          events.push({ ...base, date: campaign.endDate, kind: "end", label: "Campaign end" });
        }
        for (const session of campaign.sessions) {
          if (session.date) {
            events.push({
              ...base,
              date: session.date,
              kind: "session",
              label: session.name,
              mode: session.mode,
            });
          }
        }
      }
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    return { events, campaignColor };
  }, [clients]);

  // month grid, weeks starting Monday
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    (byDate.get(e.date) ?? byDate.set(e.date, []).get(e.date)!).push(e);
  }

  const todayIso = iso(today);
  const upcoming = events.filter((e) => e.date >= todayIso).slice(0, 8);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Every client meeting and campaign milestone in one agenda — see what's coming and where there's room to book new projects."
      />

      <div className="grid gap-6 xl:grid-cols-4">
        {/* Month grid */}
        <section className="card p-6 xl:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold tabular-nums">
              {MONTHS[month]} {year}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                className="cursor-pointer rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
              >
                Today
              </button>
              <button
                data-tip="Previous month"
                onClick={prevMonth}
                className="cursor-pointer rounded-lg border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                data-tip="Next month"
                onClick={nextMonth}
                className="cursor-pointer rounded-lg border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-mist">
                {d}
              </div>
            ))}
            {cells.map((d) => {
              const dIso = iso(d);
              const inMonth = d.getMonth() === month;
              const isToday = dIso === todayIso;
              const dayEvents = byDate.get(dIso) ?? [];
              return (
                <div
                  key={dIso}
                  className={`min-h-24 rounded-lg border p-1.5 ${
                    isToday
                      ? "border-[#ff7a55]/60 bg-[#eb320f]/8"
                      : "border-white/5 bg-navy/30"
                  } ${inMonth ? "" : "opacity-35"}`}
                >
                  <p className={`text-right text-[11px] font-bold tabular-nums ${isToday ? "text-[#ff7a55]" : "text-mist"}`}>
                    {d.getDate()}
                  </p>
                  <div className="mt-1 flex flex-col gap-1">
                    {dayEvents.map((e, i) => (
                      <Link
                        key={i}
                        href={`/campaigns/${e.campaignId}`}
                        data-tip={`${e.clientName} — ${e.label} (${e.campaignName})`}
                        className="block truncate rounded px-1.5 py-1 text-[10px] font-semibold leading-tight text-paper transition-transform hover:scale-[1.03]"
                        style={{
                          backgroundColor: `${campaignColor.get(e.campaignId)}${e.kind === "session" ? "cc" : "55"}`,
                        }}
                      >
                        {e.kind === "start" && "▶ "}
                        {e.kind === "end" && "⏁ "}
                        {e.clientName.split(" ")[0]} · {e.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* legend */}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-white/5 pt-3 text-[11px] text-mist">
            {[...campaignColor.entries()].map(([cid, color]) => {
              const ev = events.find((e) => e.campaignId === cid);
              if (!ev) return null;
              return (
                <span key={cid} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {ev.clientName}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5">▶ campaign start · ⏁ campaign end</span>
          </div>
        </section>

        {/* Upcoming agenda */}
        <section className="card self-start p-6">
          <h2 className="mb-4 text-base font-bold">Coming up</h2>
          <ul className="flex flex-col gap-3">
            {upcoming.map((e, i) => {
              const d = new Date(`${e.date}T00:00:00`);
              return (
                <li key={i}>
                  <Link
                    href={`/campaigns/${e.campaignId}`}
                    className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-white/4"
                  >
                    <span
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-paper"
                      style={{ backgroundColor: campaignColor.get(e.campaignId) }}
                    >
                      {e.kind === "start" ? (
                        <Rocket size={13} />
                      ) : e.kind === "end" ? (
                        <Flag size={13} />
                      ) : e.mode === "virtual" ? (
                        <Video size={13} />
                      ) : (
                        <MapPin size={13} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold">{e.label}</span>
                      <span className="block truncate text-[11px] text-mist">
                        {e.clientName}
                      </span>
                      <span className="block text-[11px] font-semibold tabular-nums text-mist">
                        {fmtDate(d)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {upcoming.length === 0 && (
              <li className="text-sm text-mist">
                Nothing on the calendar yet — set session dates or campaign
                start/end dates and they appear here.
              </li>
            )}
          </ul>
          <div className="mt-4 border-t border-white/5 pt-3">
            <Chip color="#a3a4f0">{events.length} dated events total</Chip>
          </div>
        </section>
      </div>
    </>
  );
}
