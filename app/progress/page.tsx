"use client";

import Link from "next/link";
import { PageHeader, Chip, StatusChip, ProgressBar } from "@/components/ui";
import { useData } from "@/lib/state";
import {
  findTemplate,
  computeSchedule,
  campaignCompletion,
  triggerSession,
  fmtDate,
  fmtDateShort,
  fmtWeekday,
} from "@/lib/store";

export default function ProgressPage() {
  const { clients, templates } = useData();
  const today = new Date();
  const rows = clients.flatMap((client) =>
    client.campaigns.map((campaign) => ({ client, campaign }))
  );

  return (
    <>
      <PageHeader
        title="Progress"
        subtitle="Every campaign's full trajectory — what has gone out, what's next, what still needs a date."
      />

      <div className="flex flex-col gap-8">
        {rows.length === 0 && (
          <div className="card p-10 text-center text-sm text-mist">
            No campaigns yet — create a client and a campaign to see progress here.
          </div>
        )}

        {rows.map(({ client, campaign }) => {
          const completion = campaignCompletion(campaign, templates, today);
          return (
            <section key={campaign.id} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="text-lg font-bold hover:underline"
                  >
                    {campaign.name}
                  </Link>
                  <Chip color="#a3a4f0">{campaign.code}</Chip>
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-xs text-mist hover:text-paper hover:underline"
                  >
                    {client.name}
                  </Link>
                  <StatusChip status={client.status} />
                </div>
                <p className="text-sm text-mist">
                  <span className="font-bold text-paper">{completion.pct}%</span> ·{" "}
                  {completion.sent} of {completion.total} lessons sent
                </p>
              </div>
              <div className="mt-4">
                <ProgressBar pct={completion.pct} />
              </div>

              <div className="mt-6 flex flex-col gap-6">
                {campaign.series.map((loaded) => {
                  const series = findTemplate(templates, loaded.templateId);
                  if (!series) return null;
                  const schedule = computeSchedule(campaign, loaded, series, today);
                  const session = triggerSession(campaign, loaded);
                  return (
                    <div key={loaded.templateId}>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <Chip color={series.color}>{series.code}</Chip>
                        <p className="text-sm font-semibold">{series.name}</p>
                        <p className="text-xs text-mist">
                          {!session
                            ? "Not bound to a session yet — no sends scheduled"
                            : session.date
                              ? `${session.name}: ${fmtDate(new Date(`${session.date}T00:00:00`))}`
                              : `${session.name}: date not set — series waits`}
                        </p>
                      </div>
                      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {schedule.map((item) => (
                          <li
                            key={item.step.id}
                            className={`rounded-xl border p-3 ${
                              item.status === "sent"
                                ? "border-transparent bg-white/8"
                                : item.status === "scheduled"
                                  ? "border-white/10 bg-navy/50"
                                  : "border-dashed border-white/10"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-bold">{item.step.code}</p>
                              <StatusChip status={item.status} />
                            </div>
                            <p className="mt-1 truncate text-xs text-mist">
                              {item.step.title}
                            </p>
                            <p className="mt-2 text-[11px] font-semibold tabular-nums text-mist">
                              {item.date
                                ? `${fmtWeekday(item.date)} ${fmtDateShort(item.date)} · ${item.step.sendTime}`
                                : "—"}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
                {campaign.series.length === 0 && (
                  <p className="text-sm text-mist">No series loaded into this campaign.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
