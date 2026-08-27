"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Megaphone, Search, Users, X } from "lucide-react";
import { PageHeader, StatusChip, GradientButton } from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { campaignStatus, findStaff } from "@/lib/store";

function NewClientForm({ onClose }: { onClose: () => void }) {
  const { dispatch } = useData();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [sector, setSector] = useState("");

  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">New client organization</h2>
        <button
          data-tip="Close without creating"
          onClick={onClose}
          className="cursor-pointer rounded-md p-1 text-mist hover:bg-white/5 hover:text-paper"
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

function ResponsibleName({ id }: { id?: string }) {
  const { staff } = useData();
  const person = findStaff(staff, id);
  if (!person)
    return <p className="text-[11px] italic text-mist/50">Unassigned</p>;
  return (
    <p data-tip={person.role} className="w-fit max-w-full truncate text-xs font-medium">
      {person.name}
    </p>
  );
}

function ClientsContent() {
  const { clients, templates, staff } = useData();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [responsible, setResponsible] = useState("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [query, setQuery] = useState("");
  const today = new Date();

  const rows = clients
    .map((client) => {
      const activeCount = client.campaigns.filter(
        (c) => campaignStatus(c, templates, today) === "active"
      ).length;
      return { client, activeCount, hasActiveCampaign: activeCount > 0 };
    })
    .sort((a, b) => a.client.name.localeCompare(b.client.name));

  const filtered = rows.filter((r) => {
    if (activeOnly && !r.hasActiveCampaign) return false;
    if (responsible === "unassigned") {
      if (r.client.phoenixLeaderId || r.client.phoenixCoachId || r.client.projectManagerId)
        return false;
    } else if (responsible !== "all") {
      if (
        r.client.phoenixLeaderId !== responsible &&
        r.client.phoenixCoachId !== responsible &&
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
              ? "brand-gradient-soft cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold text-paper"
              : "cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
          }
        >
          <span className="flex items-center gap-1.5">
            <Megaphone size={12} /> Active campaigns only
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-mist">
              Responsible
            </span>
            <select
              title="Show only clients this person is responsible for"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              <option value="all">Anyone</option>
              {staff.map((t) => (
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
              className="w-52 rounded-md border border-white/10 bg-navy/60 py-1.5 pl-7 pr-2.5 text-xs focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_6rem_minmax(0,1.5fr)_5rem_minmax(0,1.1fr)_minmax(0,1.1fr)_1rem] items-center gap-4 border-b border-white/8 px-5 py-3 text-[11px] font-medium text-mist lg:grid">
          <span>Client</span>
          <span>Status</span>
          <span>Active campaigns</span>
          <span>Members</span>
          <span>Phoenix leader</span>
          <span>Phoenix coach</span>
          <span />
        </div>

        <ul className="divide-y divide-white/5">
          {filtered.map(({ client, activeCount }) => (
            <li key={client.id}>
              <Link
                href={`/clients/${client.id}`}
                data-tip="Open this client"
                data-tip-pos="bottom"
                className="grid grid-cols-1 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/4 lg:grid-cols-[minmax(0,2.2fr)_6rem_minmax(0,1.5fr)_5rem_minmax(0,1.1fr)_minmax(0,1.1fr)_1rem] lg:gap-4"
              >
                <p className="truncate text-sm font-bold">{client.name}</p>

                <div>
                  <StatusChip status={client.status} />
                </div>

                <div className="min-w-0">
                  {client.campaigns.length > 0 ? (
                    <p
                      data-tip={`${client.campaigns.length} campaign${client.campaigns.length === 1 ? "" : "s"} in total for this client`}
                      className="w-fit text-sm font-bold tabular-nums"
                    >
                      {activeCount}
                      <span className="ml-1.5 text-xs font-semibold text-mist">
                        active campaign{activeCount === 1 ? "" : "s"}
                      </span>
                    </p>
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

                <ResponsibleName id={client.phoenixLeaderId} />
                <ResponsibleName id={client.phoenixCoachId} />

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
