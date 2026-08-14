"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Megaphone, Search, Users, X } from "lucide-react";
import { PageHeader, StatusChip, ProgressBar, GradientButton, Chip } from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { team } from "@/lib/data";
import { campaignCompletion, campaignStatus, findStaff } from "@/lib/store";

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

function ResponsibleTag({ id, label }: { id?: string; label: string }) {
  const person = findStaff(team, id);
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-mist/70">{label}</p>
      {person ? (
        <p data-tip={person.role} className="mt-0.5 flex w-fit items-center gap-1.5">
          <span className="brand-gradient flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold">
            {person.initials}
          </span>
          <span className="truncate text-xs font-medium">{person.name}</span>
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] italic text-mist/50">Unassigned</p>
      )}
    </div>
  );
}

function ClientsContent() {
  const { clients, templates } = useData();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [responsible, setResponsible] = useState("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [query, setQuery] = useState("");
  const today = new Date();

  const rows = clients
    .map((client) => {
      const totals = client.campaigns.reduce(
        (acc, c) => {
          const x = campaignCompletion(c, templates, today);
          return { sent: acc.sent + x.sent, total: acc.total + x.total };
        },
        { sent: 0, total: 0 }
      );
      return {
        client,
        totals,
        pct: totals.total ? Math.round((totals.sent / totals.total) * 100) : 0,
        hasActiveCampaign: client.campaigns.some(
          (c) => campaignStatus(c, templates, today) === "active"
        ),
      };
    })
    .sort((a, b) => a.client.name.localeCompare(b.client.name));

  const filtered = rows.filter((r) => {
    if (activeOnly && !r.hasActiveCampaign) return false;
    if (responsible === "unassigned") {
      if (r.client.accountManagerId || r.client.projectManagerId) return false;
    } else if (responsible !== "all") {
      if (
        r.client.accountManagerId !== responsible &&
        r.client.projectManagerId !== responsible
      )
        return false;
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        `${r.client.name} ${r.client.sector} ${r.client.location} ` +
        r.client.campaigns.map((c) => `${c.name} ${c.code}`).join(" ");
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Every client organization, alphabetically, with their Phoenix responsibles."
        action={
          <GradientButton onClick={() => setShowForm(true)}>+ New client</GradientButton>
        }
      />

      {showForm && <NewClientForm onClose={() => setShowForm(false)} />}

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-4">
        <button
          data-tip="Show only clients that currently have an active campaign"
          onClick={() => setActiveOnly((v) => !v)}
          className={
            activeOnly
              ? "brand-gradient-soft cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-paper"
              : "cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
          }
        >
          <span className="flex items-center gap-1.5">
            <Megaphone size={12} /> Active campaigns only
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
              Responsible
            </span>
            <select
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              <option value="all">Anyone</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mist"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients…"
              title="Search by name, sector, location or campaign"
              className="w-52 rounded-lg border border-white/10 bg-navy/60 py-1.5 pl-7 pr-2.5 text-xs focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_6rem_minmax(0,1.5fr)_5rem_minmax(0,1.1fr)_minmax(0,1.1fr)_1rem] items-center gap-4 border-b border-white/8 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-mist lg:grid">
          <span>Client</span>
          <span>Status</span>
          <span>Campaigns</span>
          <span>Members</span>
          <span>Account manager</span>
          <span>Project manager</span>
          <span />
        </div>

        <ul className="divide-y divide-white/5">
          {filtered.map(({ client, totals, pct }) => (
            <li key={client.id}>
              <Link
                href={`/clients/${client.id}`}
                className="grid grid-cols-1 items-center gap-3 px-5 py-4 transition-colors hover:bg-white/4 lg:grid-cols-[minmax(0,2.2fr)_6rem_minmax(0,1.5fr)_5rem_minmax(0,1.1fr)_minmax(0,1.1fr)_1rem] lg:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{client.name}</p>
                  <p className="mt-0.5 truncate text-xs text-mist">
                    {client.sector} · {client.location}
                  </p>
                </div>

                <div>
                  <StatusChip status={client.status} />
                </div>

                <div className="min-w-0">
                  {client.campaigns.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {client.campaigns.map((c) => (
                          <Chip key={c.id} color="#a3a4f0">
                            {c.code}
                          </Chip>
                        ))}
                      </div>
                      <div className="mt-1.5 max-w-44">
                        <ProgressBar pct={pct} />
                        <p className="mt-1 text-[10px] text-mist">
                          {totals.sent}/{totals.total} lessons sent
                        </p>
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] italic text-mist/50">No campaigns</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-mist">
                  <Users size={12} />
                  <span className="font-bold tabular-nums text-paper">
                    {client.members.length}
                  </span>
                </div>

                <ResponsibleTag id={client.accountManagerId} label="Account mgr" />
                <ResponsibleTag id={client.projectManagerId} label="Phoenix PM" />

                <ChevronRight size={16} className="hidden text-mist lg:block" />
              </Link>
            </li>
          ))}

          {filtered.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-mist">
              No clients match these filters.
            </li>
          )}
        </ul>
      </div>

      <p className="mt-3 text-xs text-mist">
        Showing {filtered.length} of {rows.length} clients, sorted alphabetically.
      </p>
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
