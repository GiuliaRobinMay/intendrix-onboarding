"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Users, X } from "lucide-react";
import { PageHeader, StatusChip, ProgressBar, GradientButton, Chip } from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { findTemplate, programCompletion, fmtDate } from "@/lib/store";

function NewClientForm({ onClose }: { onClose: () => void }) {
  const { dispatch } = useData();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [sector, setSector] = useState("");

  return (
    <div className="card mb-6 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">New client organization</h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1 text-mist hover:bg-white/5 hover:text-paper"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Organization name" value={name} onChange={setName} placeholder="e.g. CareSouth Carolina" />
        <Field label="Location" value={location} onChange={setLocation} placeholder="e.g. South Carolina, USA" />
        <Field label="Sector" value={sector} onChange={setSector} placeholder="e.g. Community healthcare" />
      </div>
      <div className="mt-4">
        <GradientButton
          onClick={() => {
            if (!name.trim()) return;
            dispatch({ type: "addClient", name: name.trim(), location, sector });
            onClose();
          }}
        >
          Create client
        </GradientButton>
      </div>
    </div>
  );
}

function ClientsContent() {
  const { clients, templates } = useData();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const today = new Date();

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Every client organization and the trajectory built for them."
        action={
          <GradientButton onClick={() => setShowForm(true)}>+ New client</GradientButton>
        }
      />

      {showForm && <NewClientForm onClose={() => setShowForm(false)} />}

      <div className="grid gap-5 md:grid-cols-2">
        {clients.map((client) => {
          const program = client.programs[0];
          const completion = program ? programCompletion(program, templates, today) : null;
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
                        .map((id) => findTemplate(templates, id)?.code)
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-mist">
                  No program yet — open the client and load a module to begin.
                </div>
              )}
            </Link>
          );
        })}

        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-44 cursor-pointer items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 text-sm font-semibold text-mist/60 transition-colors hover:border-white/25 hover:text-paper"
        >
          + Add a client organization
        </button>
      </div>
    </>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsContent />
    </Suspense>
  );
}
