"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Layers, Search, Users } from "lucide-react";
import { PageHeader, Chip, ProgressBar, GradientButton } from "@/components/ui";
import { NewCampaignForm } from "@/components/campaign-form";
import { useData } from "@/lib/state";
import { team } from "@/lib/data";
import {
  campaignCompletion,
  campaignStatus,
  findStaff,
  findTemplate,
  seriesProgress,
  fmtDate,
} from "@/lib/store";
import type { CampaignStatus } from "@/lib/types";

const STATUS_STYLE: Record<CampaignStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: "rgba(74,222,128,0.14)", fg: "#4ade80", label: "Active" },
  upcoming: { bg: "rgba(235,50,15,0.16)", fg: "#ff7a55", label: "Upcoming" },
  closed: { bg: "rgba(174,176,178,0.14)", fg: "#aeb0b2", label: "Closed" },
};

function StatusPill({ status }: { status: CampaignStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function StaffTag({ id, fallback }: { id?: string; fallback: string }) {
  const person = findStaff(team, id);
  if (!person) {
    return <span className="text-[11px] italic text-mist/50">{fallback}</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="brand-gradient flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
        {person.initials}
      </span>
      <span className="truncate text-xs font-medium">{person.name}</span>
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CampaignsPage() {
  const { clients, templates } = useData();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [accountManager, setAccountManager] = useState("all");
  const [campaignManager, setCampaignManager] = useState("all");
  const [query, setQuery] = useState("");
  const today = new Date();

  const rows = useMemo(
    () =>
      clients.flatMap((client) =>
        client.campaigns.map((campaign) => ({
          client,
          campaign,
          status: campaignStatus(campaign, templates, today),
          completion: campaignCompletion(campaign, templates, today),
        }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, templates]
  );

  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    upcoming: rows.filter((r) => r.status === "upcoming").length,
    closed: rows.filter((r) => r.status === "closed").length,
  };

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (accountManager !== "all" && r.campaign.accountManagerId !== accountManager)
      return false;
    if (campaignManager !== "all" && r.campaign.campaignManagerId !== campaignManager)
      return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = `${r.client.name} ${r.campaign.name} ${r.campaign.code}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const staffOptions = [
    { value: "all", label: "Anyone" },
    ...team.map((t) => ({ value: t.id, label: t.name })),
  ];

  const tabs: Array<{ key: "all" | CampaignStatus; label: string }> = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "upcoming", label: "Upcoming" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Every campaign across all clients."
        action={
          clients.length > 0 && (
            <GradientButton onClick={() => setCreatingFor(clients[0].id)}>
              + New campaign
            </GradientButton>
          )
        }
      />

      {creatingFor && (
        <div className="mb-6">
          <div className="card mb-3 flex flex-wrap items-center gap-3 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-mist">
              Client
            </span>
            <select
              value={creatingFor}
              onChange={(e) => setCreatingFor(e.target.value)}
              className="rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <NewCampaignForm clientId={creatingFor} onClose={() => setCreatingFor(null)} />
        </div>
      )}

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const on = status === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={
                  on
                    ? "brand-gradient-soft cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-paper"
                    : "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-mist transition-colors hover:bg-white/5 hover:text-paper"
                }
              >
                {t.label}
                <span className={on ? "ml-1.5 opacity-80" : "ml-1.5 text-mist/60"}>
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect
            label="Account mgr"
            value={accountManager}
            onChange={setAccountManager}
            options={staffOptions}
          />
          <FilterSelect
            label="Campaign mgr"
            value={campaignManager}
            onChange={setCampaignManager}
            options={staffOptions}
          />
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mist"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client or campaign…"
              className="w-52 rounded-lg border border-white/10 bg-navy/60 py-1.5 pl-7 pr-2.5 text-xs focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {/* header row */}
        <div className="hidden grid-cols-[minmax(0,2.4fr)_6rem_minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_1rem] items-center gap-4 border-b border-white/8 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-mist lg:grid">
          <span>Client / campaign</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Account manager</span>
          <span>Campaign manager</span>
          <span />
        </div>

        <ul className="divide-y divide-white/5">
          {filtered.map(({ client, campaign, status: st, completion }) => {
            const next = campaign.sessions
              .filter((s) => s.date && new Date(`${s.date}T00:00:00`) >= today)
              .sort((a, b) => a.date!.localeCompare(b.date!))[0];
            return (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="grid grid-cols-1 items-center gap-3 px-5 py-4 transition-colors hover:bg-white/4 lg:grid-cols-[minmax(0,2.4fr)_6rem_minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_1rem] lg:gap-4"
                >
                  {/* client first, campaign type underneath */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{client.name}</p>
                    <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-mist">
                      <Chip color="#a3a4f0">{campaign.code}</Chip>
                      <span className="truncate">{campaign.name}</span>
                    </p>
                  </div>

                  <div className="lg:justify-self-start">
                    <StatusPill status={st} />
                  </div>

                  <div className="min-w-0">
                    <ProgressBar pct={completion.pct} />
                    <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-mist">
                      <span>
                        {completion.sent}/{completion.total} lessons
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays size={11} />
                        {next ? fmtDate(new Date(`${next.date}T00:00:00`)) : "no next session"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers size={11} />
                        {campaign.series.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {client.members.length}
                      </span>
                    </p>
                  </div>

                  <div className="min-w-0">
                    <StaffTag id={campaign.accountManagerId} fallback="Unassigned" />
                  </div>
                  <div className="min-w-0">
                    <StaffTag id={campaign.campaignManagerId} fallback="Unassigned" />
                  </div>

                  <ChevronRight size={16} className="hidden text-mist lg:block" />
                </Link>
              </li>
            );
          })}

          {filtered.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-mist">
              {rows.length === 0
                ? "No campaigns yet."
                : "No campaigns match these filters."}
            </li>
          )}
        </ul>
      </div>

      {filtered.length > 0 && (
        <p className="mt-3 text-xs text-mist">
          Showing {filtered.length} of {rows.length} campaigns
          {filtered.some((r) =>
            r.campaign.series.some((s) => {
              const series = findTemplate(templates, s.templateId);
              return series
                ? !seriesProgress(r.campaign, s, series, today).bound
                : false;
            })
          )
            ? " · some series are not bound to a session yet"
            : ""}
        </p>
      )}
    </>
  );
}
