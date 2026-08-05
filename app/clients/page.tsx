import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { PageHeader, StatusChip, ProgressBar, GradientButton, Chip } from "@/components/ui";
import { getClients, getSeriesTemplate, programCompletion, fmtDate } from "@/lib/store";

export default function ClientsPage() {
  const today = new Date();
  const clients = getClients();

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Every client organization and the trajectory built for them."
        action={<GradientButton>+ New client</GradientButton>}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {clients.map((client) => {
          const program = client.programs[0];
          const completion = program ? programCompletion(program, today) : null;
          const nextSession = program?.sessions.find(
            (s) => s.date && new Date(`${s.date}T00:00:00`) >= today
          );
          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="card card-hover block p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{client.name}</h2>
                  <p className="mt-1 flex items-center gap-3 text-xs text-mist">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {client.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {client.members.length} members
                    </span>
                  </p>
                </div>
                <StatusChip status={client.status} />
              </div>

              {program && completion ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <Chip color="#a3a4f0">{program.code}</Chip>
                    <span className="text-[11px] text-mist">
                      {nextSession
                        ? `Next: ${nextSession.name} · ${fmtDate(new Date(`${nextSession.date}T00:00:00`))}`
                        : "Next session date to plan"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar pct={completion.pct} />
                    <p className="mt-1.5 text-[11px] text-mist">
                      {completion.sent} of {completion.total} lessons sent ·{" "}
                      {program.seriesIds
                        .map((id) => getSeriesTemplate(id)?.code)
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-mist">
                  No program yet — create a project and load a module to begin.
                </div>
              )}
            </Link>
          );
        })}

        {/* add-client ghost card */}
        <div className="flex min-h-44 items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 text-sm font-semibold text-mist/60">
          + Add a client organization
        </div>
      </div>
    </>
  );
}
