"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Megaphone, Users, X } from "lucide-react";
import { PageHeader, StatusChip, ProgressBar, GradientButton, Chip } from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { campaignCompletion } from "@/lib/store";

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
        subtitle="Every client organization and the campaigns running for them."
        action={
          <GradientButton onClick={() => setShowForm(true)}>+ New client</GradientButton>
        }
      />

      {showForm && <NewClientForm onClose={() => setShowForm(false)} />}

      <div className="grid gap-5 md:grid-cols-2">
        {clients.map((client) => {
          const totals = client.campaigns.reduce(
            (acc, c) => {
              const x = campaignCompletion(c, templates, today);
              return { sent: acc.sent + x.sent, total: acc.total + x.total };
            },
            { sent: 0, total: 0 }
          );
          const pct = totals.total ? Math.round((totals.sent / totals.total) * 100) : 0;
          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="card card-hover block p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{client.name}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-mist">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {client.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {client.members.length} members
                    </span>
                    <span className="flex items-center gap-1">
                      <Megaphone size={12} /> {client.campaigns.length} campaign
                      {client.campaigns.length === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
                <StatusChip status={client.status} />
              </div>

              {client.campaigns.length > 0 ? (
                <div className="mt-5">
                  <div className="flex flex-wrap gap-1.5">
                    {client.campaigns.map((c) => (
                      <Chip key={c.id} color="#a3a4f0">
                        {c.code} · {c.name}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-3">
                    <ProgressBar pct={pct} />
                    <p className="mt-1.5 text-[11px] text-mist">
                      {totals.sent} of {totals.total} lessons sent across all campaigns
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-mist">
                  No campaigns yet — open the client to create one.
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
