import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Video,
  MapPin,
  CircleCheck,
  CircleDashed,
} from "lucide-react";
import {
  PageHeader,
  StatusChip,
  Chip,
  ProgressBar,
  GradientButton,
  GhostButton,
} from "@/components/ui";
import {
  getClient,
  getSeriesTemplate,
  seriesProgress,
  fmtDate,
  fmtDateShort,
} from "@/lib/store";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getClient(id);
  if (!client) notFound();

  const today = new Date();
  const program = client.programs[0];

  return (
    <>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> All clients
      </Link>

      <PageHeader
        title={client.name}
        subtitle={`${client.sector} · ${client.location}`}
        action={
          <div className="flex items-center gap-3">
            <StatusChip status={client.status} />
            <GhostButton>Edit client</GhostButton>
          </div>
        }
      />

      {!program ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-mist">
            No program yet for this client.
          </p>
          <div className="mt-4 flex justify-center">
            <GradientButton>Load a module template</GradientButton>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Sessions + series — main column */}
          <div className="flex flex-col gap-6 xl:col-span-2">
            {/* Session dates */}
            <section className="card p-6">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <CalendarDays size={17} className="text-mist" /> Session dates
                </h2>
                <Chip color="#a3a4f0">{program.code}</Chip>
              </div>
              <p className="mb-5 text-xs text-mist">
                Entering a session date schedules the series that follows it. Timezone: {program.timezone}.
              </p>
              <ol className="grid gap-3 md:grid-cols-5">
                {program.sessions.map((session, i) => {
                  const date = session.date ? new Date(`${session.date}T00:00:00`) : null;
                  const past = date !== null && date < today;
                  return (
                    <li key={session.key} className="card p-3.5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-mist">
                        Session {i + 1}
                      </p>
                      <p className="mt-1 min-h-8 text-xs font-semibold leading-tight">
                        {session.name}
                      </p>
                      <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-mist">
                        {session.mode === "virtual" ? (
                          <>
                            <Video size={11} /> virtual
                          </>
                        ) : (
                          <>
                            <MapPin size={11} /> in person
                          </>
                        )}
                      </p>
                      <div
                        className={`mt-3 rounded-lg border px-2 py-1.5 text-xs font-bold tabular-nums ${
                          date
                            ? past
                              ? "border-transparent bg-white/8 text-paper"
                              : "brand-gradient-soft border-transparent text-paper"
                            : "border-dashed border-white/15 text-mist/70"
                        }`}
                      >
                        {date ? fmtDateShort(date) : "Set date"}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* Loaded series */}
            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold">Loaded series</h2>
                <GhostButton>+ Load another module</GhostButton>
              </div>
              <div className="flex flex-col gap-3">
                {program.seriesIds.map((sid) => {
                  const series = getSeriesTemplate(sid);
                  if (!series) return null;
                  const p = seriesProgress(program, series, today);
                  return (
                    <Link
                      key={sid}
                      href={`/modules/${sid}`}
                      className="card card-hover flex items-center gap-4 p-4"
                    >
                      <div
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-paper"
                        style={{ backgroundColor: series.color }}
                      >
                        {series.code}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">
                          {series.name}
                          <span className="ml-2 font-medium text-mist">· {series.focus}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-mist">
                          Triggered by {series.triggerLabel} ·{" "}
                          {p.scheduled
                            ? p.next
                              ? `next send ${fmtDate(p.next.date!)}`
                              : "all sent"
                            : "awaiting session date"}
                        </p>
                        <div className="mt-2 max-w-72">
                          <ProgressBar
                            pct={p.total ? (p.sent / p.total) * 100 : 0}
                            color={series.color}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums">
                          {p.sent}/{p.total}
                        </p>
                        <p className="text-[11px] text-mist">sent</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Members */}
          <section className="card self-start p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Members</h2>
              <div className="flex items-center gap-2">
                <Chip>Sample data</Chip>
                <span className="text-xs font-semibold text-mist">
                  {client.members.length}
                </span>
              </div>
            </div>
            <ul className="flex max-h-130 flex-col gap-1 overflow-y-auto pr-1">
              {client.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/4"
                >
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      m.role === "leader" ? "brand-gradient" : "bg-white/8 text-mist"
                    }`}
                  >
                    {m.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {m.name}
                      {m.role === "leader" && (
                        <Crown size={12} className="shrink-0 text-[#ff7a55]" />
                      )}
                    </p>
                    <p className="truncate text-[11px] text-mist">{m.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-mist/70">
                    {m.role === "leader" ? "Leader series" : "Participant"}
                  </span>
                </li>
              ))}
              {client.members.length === 0 && (
                <li className="py-4 text-sm text-mist">No members yet.</li>
              )}
            </ul>
            <div className="mt-4 border-t border-white/5 pt-4 text-xs leading-relaxed text-mist">
              <p className="flex items-center gap-1.5">
                <CircleCheck size={13} className="text-[#4ade80]" />
                Leader receives the Leader series (with Leaders Guides).
              </p>
              <p className="mt-1.5 flex items-center gap-1.5">
                <CircleDashed size={13} />
                Coaches receive a copy of every send.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
