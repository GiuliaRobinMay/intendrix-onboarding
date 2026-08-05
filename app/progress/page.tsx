import Link from "next/link";
import { PageHeader, Chip, StatusChip, ProgressBar } from "@/components/ui";
import {
  getClients,
  getSeriesTemplate,
  computeSchedule,
  programCompletion,
  fmtDate,
  fmtDateShort,
  fmtWeekday,
} from "@/lib/store";

export default function ProgressPage() {
  const today = new Date();
  const clientsWithPrograms = getClients().filter((c) => c.programs.length > 0);

  return (
    <>
      <PageHeader
        title="Progress"
        subtitle="Every client's full 26-week trajectory — what has gone out, what's next, what still needs a date."
      />

      <div className="flex flex-col gap-8">
        {clientsWithPrograms.map((client) =>
          client.programs.map((program) => {
            const completion = programCompletion(program, today);
            return (
              <section key={program.id} className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-lg font-bold hover:underline"
                    >
                      {client.name}
                    </Link>
                    <Chip color="#a3a4f0">{program.code}</Chip>
                    <StatusChip status={client.status} />
                  </div>
                  <p className="text-sm text-mist">
                    <span className="font-bold text-paper">{completion.pct}%</span>{" "}
                    · {completion.sent} of {completion.total} lessons sent
                  </p>
                </div>
                <div className="mt-4">
                  <ProgressBar pct={completion.pct} />
                </div>

                <div className="mt-6 flex flex-col gap-6">
                  {program.seriesIds.map((sid) => {
                    const series = getSeriesTemplate(sid);
                    if (!series) return null;
                    const schedule = computeSchedule(program, series, today);
                    const session = program.sessions.find(
                      (s) => s.key === series.trigger
                    );
                    return (
                      <div key={sid}>
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <Chip color={series.color}>{series.code}</Chip>
                          <p className="text-sm font-semibold">{series.name}</p>
                          <p className="text-xs text-mist">
                            {session?.date
                              ? `${series.triggerLabel}: ${fmtDate(new Date(`${session.date}T00:00:00`))}`
                              : `${series.triggerLabel}: date not set — series waits`}
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
                                <p className="truncate text-xs font-bold">
                                  {item.step.code}
                                </p>
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
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
