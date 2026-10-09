"use client";

import Link from "next/link";
import { CAMPAIGN_TONE, wash } from "@/lib/status-colors";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronRight, Search, Users } from "lucide-react";
import { PageHeader, Chip, ProgressBar, GradientButton } from "@/components/ui";
import { NewCampaignWizard } from "@/components/new-campaign-wizard";
import {
  CampaignStatusSelect,
  RoleSelect,
  SenderSelect,
} from "@/components/row-editors";
import { useData } from "@/lib/state";
import {
  campaignCompletion,
  campaignStatus,
  effectiveRole,
  findStaff,
  findTemplate,
  seriesProgress,
  fmtDate,
} from "@/lib/store";
import type { CampaignStatus } from "@/lib/types";

const STATUS_STYLE: Record<CampaignStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: wash(CAMPAIGN_TONE.active), fg: CAMPAIGN_TONE.active, label: "Active" },
  upcoming: { bg: wash(CAMPAIGN_TONE.upcoming), fg: CAMPAIGN_TONE.upcoming, label: "Upcoming" },
  paused: { bg: wash(CAMPAIGN_TONE.paused), fg: CAMPAIGN_TONE.paused, label: "Paused" },
  closed: { bg: wash(CAMPAIGN_TONE.closed), fg: CAMPAIGN_TONE.closed, label: "Closed" },
};

const STATUS_TIP: Record<CampaignStatus, string> = {
  active: "Lessons are going out for this campaign",
  upcoming: "Nothing has been sent yet — the campaign lies ahead",
  paused: "On hold — no sends go out until the campaign is reopened",
  closed: "Every scheduled lesson has been sent, or it was closed by hand",
};

function StatusPill({ status }: { status: CampaignStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      data-tip={STATUS_TIP[status]}
      className="chip inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ "--chip-c": s.fg } as CSSProperties}
    >
      {s.label}
    </span>
  );
}

function StaffTag({ id, fallback }: { id?: string; fallback: string }) {
  const { staff } = useData();
  const person = findStaff(staff, id);
  if (!person) {
    return <span className="text-[11px] italic text-mist/50">{fallback}</span>;
  }
  return (
    <span
      data-tip={person.role}
      className="w-fit max-w-full truncate text-xs font-medium"
    >
      {person.name}
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
      <span className="text-[11px] font-medium text-mist">
        {label}
      </span>
      <select
        title={`Filter the list by ${label.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
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
  const { clients, templates, staff } = useData();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const router = useRouter();
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [leaderFilter, setLeaderFilter] = useState("all");
  const [coachFilter, setCoachFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
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
    paused: rows.filter((r) => r.status === "paused").length,
    closed: rows.filter((r) => r.status === "closed").length,
  };

  const filtered = rows.filter((r) => {
    if (clientFilter !== "all" && r.client.id !== clientFilter) return false;
    if (status !== "all" && r.status !== status) return false;
    if (
      leaderFilter !== "all" &&
      effectiveRole(r.client, r.campaign, "phoenixLeaderId", staff)?.id !== leaderFilter
    )
      return false;
    if (
      coachFilter !== "all" &&
      effectiveRole(r.client, r.campaign, "phoenixCoachId", staff)?.id !== coachFilter
    )
      return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = `${r.client.name} ${r.campaign.name} ${r.campaign.code}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // the list reads top to bottom in order of attention: what is running,
  // what lies ahead, what is on hold, and finally what is finished
  const GROUP_ORDER: CampaignStatus[] = ["active", "upcoming", "paused", "closed"];
  const groups = GROUP_ORDER.map((st) => ({
    st,
    rows: filtered
      .filter((r) => r.status === st)
      .sort((a, b) => a.client.name.localeCompare(b.client.name)),
  })).filter((g) => g.rows.length > 0);

  const staffOptions = [
    { value: "all", label: "Anyone" },
    ...staff.map((t) => ({ value: t.id, label: t.name })),
  ];

  const clientOptions = [
    { value: "all", label: "All clients" },
    ...clients
      .filter((c) => c.campaigns.length > 0)
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  const tabs: Array<{ key: "all" | CampaignStatus; label: string }> = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "upcoming", label: "Upcoming" },
    { key: "paused", label: "Paused" },
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
            <span className="text-xs font-medium text-mist">
              Client
            </span>
            <select
              data-tip="Which client this new campaign belongs to"
              value={creatingFor}
              onChange={(e) => setCreatingFor(e.target.value)}
              className="rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-[13px] focus:border-white/30 focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <NewCampaignWizard
            clientId={creatingFor}
            onClose={() => setCreatingFor(null)}
            onCreated={(id) => router.push(`/campaigns/${id}`)}
          />
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
                data-tip={t.key === "all" ? "Every campaign, whatever its status" : STATUS_TIP[t.key]}
                onClick={() => setStatus(t.key)}
                className={
                  on
                    ? "brand-gradient-soft cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold text-paper"
                    : "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold text-mist transition-colors hover:bg-white/5 hover:text-paper"
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
            label="Client"
            value={clientFilter}
            onChange={setClientFilter}
            options={clientOptions}
          />
          <FilterSelect
            label="Leader"
            value={leaderFilter}
            onChange={setLeaderFilter}
            options={staffOptions}
          />
          <FilterSelect
            label="Coach"
            value={coachFilter}
            onChange={setCoachFilter}
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
              title="Type to filter by client or campaign name"
              className="w-52 rounded-md border border-white/10 bg-navy/60 py-1.5 pl-7 pr-2.5 text-xs focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {/* header row */}
        <div className="hidden grid-cols-[minmax(0,1.3fr)_7.5rem_minmax(0,1.5fr)_minmax(0,1.05fr)_minmax(0,1.2fr)_1rem] items-center gap-4 border-b border-white/8 px-5 py-3 text-[11px] font-medium text-mist lg:grid">
          <span>Client / campaign</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Phoenix leader</span>
          <span>Emails sent from</span>
          <span />
        </div>

        <ul className="divide-y divide-white/5">
          {groups.map((g) => (
            <Fragment key={g.st}>
              {/* subdivision header — one per status, in reading order */}
              <li className="bg-white/3 px-5 py-2">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: STATUS_STYLE[g.st].fg }}
                >
                  {STATUS_STYLE[g.st].label}
                </span>
                <span className="ml-2 text-[11px] font-semibold text-mist">
                  {g.rows.length}
                </span>
              </li>
              {g.rows.map(({ client, campaign, status: st, completion }) => {
            const next = campaign.sessions
              .filter((s) => s.date && new Date(`${s.date}T00:00:00`) >= today)
              .sort((a, b) => a.date!.localeCompare(b.date!))[0];
            return (
              <li key={campaign.id}>
                <div className="grid grid-cols-1 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/4 lg:grid-cols-[minmax(0,1.3fr)_7.5rem_minmax(0,1.5fr)_minmax(0,1.05fr)_minmax(0,1.2fr)_1rem] lg:gap-4">
                  {/* client first, campaign type underneath. Only the name
                      and the arrow navigate now: the rest of the row is
                      editable, and a dropdown inside a link is a trap. */}
                  <Link href={`/campaigns/${campaign.id}`} className="min-w-0 group">
                    <p className="truncate text-sm font-bold group-hover:underline">
                      {client.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-mist">
                      <Chip color="#a3a4f0">{campaign.code}</Chip>
                      <span className="truncate">{campaign.name}</span>
                    </p>
                  </Link>

                  {/* no justify-self here: it shrinks the cell to its
                      content instead of filling the column, which is
                      what was clipping "Upcoming" to "Upcomi…" */}
                  <div className="min-w-0">
                    <CampaignStatusSelect
                      client={client}
                      campaign={campaign}
                      derived={campaignStatus(
                        { ...campaign, statusOverride: undefined },
                        templates,
                        today
                      )}
                    />
                  </div>

                  <div className="min-w-0">
                    <ProgressBar pct={completion.pct} />
                    {/* One line under the bar. The series count was a
                        number with no unit beside it — nobody could
                        tell what a bare 6 was counting — and four
                        facts stacked four deep made the row twice the
                        height it needed. */}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 text-[11px] whitespace-nowrap text-mist">
                      <span>
                        {completion.sent}/{completion.total} lessons
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {client.members.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays size={11} />
                        {next ? fmtDate(new Date(`${next.date}T00:00:00`)) : "no next session"}
                      </span>
                    </p>
                  </div>

                  <RoleSelect
                    client={client}
                    campaign={campaign}
                    role="phoenixLeaderId"
                    staff={staff}
                  />
                  <SenderSelect client={client} campaign={campaign} staff={staff} />

                  <Link
                    href={`/campaigns/${campaign.id}`}
                    data-tip="Open this campaign"
                    className="hidden text-mist hover:text-paper lg:block"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </li>
            );
          })}
            </Fragment>
          ))}

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
