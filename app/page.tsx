import Link from "next/link";
import { CalendarDays, Mail, ArrowRight } from "lucide-react";
import { PageHeader, StatCard, Chip, StatusChip, ProgressBar, GradientButton } from "@/components/ui";
import {
  dashboardStats,
  upcomingSends,
  getClients,
  getSeriesTemplate,
  programCompletion,
  seriesProgress,
  fmtDate,
  fmtDateShort,
  fmtWeekday,
} from "@/lib/store";

export default function DashboardPage() {
  const today = new Date();
  const stats = dashboardStats(today);
  const sends = upcomingSends(today).slice(0, 6);
  const activeClients = getClients().filter((c) => c.status === "active");

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Today is ${fmtDate(today)} — here's what's moving.`}
        action={
          <Link href="/clients">
            <GradientButton>+ New client</GradientButton>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard accent label="Active clients" value={stats.activeClients} hint="1 more onboarding" />
        <StatCard label="Members enrolled" value={stats.membersEnrolled} hint="across all programs" />
        <StatCard label="Sends · next 30 days" value={stats.scheduledNext30} hint="emails scheduled" />
        <StatCard
          label="Module library"
          value={stats.seriesInLibrary}
          hint={`${stats.totalLessons} lessons in 5 series`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {/* Upcoming sends */}
        <section className="card p-6 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Mail size={17} className="text-mist" /> Upcoming sends
            </h2>
            <Link
              href="/progress"
              className="flex items-center gap-1 text-xs font-semibold text-mist transition-colors hover:text-paper"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <ul className="divide-y divide-white/5">
            {sends.map((s) => (
              <li key={`${s.client.id}-${s.step.id}`} className="flex items-center gap-4 py-3">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-[10px] font-bold uppercase text-mist">
                    {fmtWeekday(s.date!)}
                  </p>
                  <p className="text-sm font-bold tabular-nums">{fmtDateShort(s.date!)}</p>
                </div>
                <div
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: s.series.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {s.step.code} · {s.step.title}
                  </p>
                  <p className="truncate text-xs text-mist">
                    {s.client.shortName} · {s.step.sendTime} · Participant + Leader
                  </p>
                </div>
                <Chip color={s.series.color}>{s.series.code}</Chip>
              </li>
            ))}
            {sends.length === 0 && (
              <li className="py-6 text-sm text-mist">No sends scheduled yet.</li>
            )}
          </ul>
        </section>

        {/* Clients overview */}
        <section className="card p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <CalendarDays size={17} className="text-mist" /> Programs
            </h2>
            <Link
              href="/clients"
              className="flex items-center gap-1 text-xs font-semibold text-mist transition-colors hover:text-paper"
            >
              All clients <ArrowRight size={13} />
            </Link>
          </div>

          <div className="flex flex-col gap-5">
            {activeClients.map((client) =>
              client.programs.map((program) => {
                const completion = programCompletion(program, today);
                return (
                  <Link
                    key={program.id}
                    href={`/clients/${client.id}`}
                    className="card card-hover block p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{client.name}</p>
                      <StatusChip status={client.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-mist">{program.code} · {client.members.length} members</p>
                    <div className="mt-3">
                      <ProgressBar pct={completion.pct} />
                      <p className="mt-1.5 text-[11px] text-mist">
                        {completion.sent} of {completion.total} lessons sent
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {program.seriesIds.map((id) => {
                        const series = getSeriesTemplate(id);
                        if (!series) return null;
                        const p = seriesProgress(program, series, today);
                        return (
                          <Chip key={id} color={p.scheduled ? series.color : undefined}>
                            {series.code} {p.scheduled ? `${p.sent}/${p.total}` : "· no date"}
                          </Chip>
                        );
                      })}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </>
  );
}
