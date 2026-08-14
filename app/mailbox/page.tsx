"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Crown,
  ExternalLink,
  Inbox,
  Search,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { PageHeader, Chip, StatusChip } from "@/components/ui";
import { useData } from "@/lib/state";
import { team } from "@/lib/data";
import {
  campaignStatus,
  effectiveRole,
  mailboxItems,
  addDays,
  fmtDate,
  fmtDateShort,
  fmtWeekday,
  type MailboxItem,
} from "@/lib/store";
import type { StepContent } from "@/lib/types";

type Scope = "today" | "week" | "upcoming" | "sent" | "awaiting";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dayLabel(d: Date, today: Date): string {
  const dIso = iso(d);
  if (dIso === iso(today)) return `Today · ${fmtWeekday(d)} ${fmtDateShort(d)}`;
  if (dIso === iso(addDays(today, 1))) return `Tomorrow · ${fmtWeekday(d)} ${fmtDateShort(d)}`;
  return `${fmtWeekday(d)} ${fmtDate(d)}`;
}

function VariantPreview({
  label,
  content,
  leader,
}: {
  label: string;
  content: StepContent;
  leader?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/3 p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mist">
        {leader ? <Crown size={11} className="text-[#ff7a55]" /> : <Users size={11} />}
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold">{content.emailSubject}</p>
      <p className="mt-1 text-xs leading-relaxed text-mist">{content.emailBody}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {content.lesson &&
          (content.lesson.url ? (
            <a
              href={content.lesson.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-0.5 text-[11px] font-medium text-mist transition-colors hover:bg-white/10 hover:text-paper"
            >
              <ExternalLink size={11} /> {content.lesson.label}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#eb320f]/15 px-2 py-0.5 text-[11px] font-semibold text-[#ff7a55]">
              <TriangleAlert size={11} /> {content.lesson.label} — link missing
            </span>
          ))}
        {content.extras?.map((x) =>
          x.url ? (
            <a
              key={x.label}
              href={x.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-0.5 text-[11px] font-medium text-mist transition-colors hover:bg-white/10 hover:text-paper"
            >
              <ExternalLink size={11} /> {x.label}
            </a>
          ) : null
        )}
      </div>
    </div>
  );
}

export default function MailboxPage() {
  const { clients, templates } = useData();
  const today = new Date();
  const todayIso = iso(today);

  const [scope, setScope] = useState<Scope>("upcoming");
  const [clientFilter, setClientFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [responsible, setResponsible] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const items = useMemo(
    () => mailboxItems(clients, templates, team, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, templates]
  );

  // Monday..Sunday of the current week
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const periodActive = from !== "" || to !== "";

  const counts = {
    today: items.filter((i) => i.date && iso(i.date) === todayIso).length,
    week: items.filter(
      (i) => i.date && i.date >= weekStart && i.date <= addDays(weekEnd, 1)
    ).length,
    upcoming: items.filter((i) => i.status === "scheduled").length,
    sent: items.filter((i) => i.status === "sent").length,
    awaiting: items.filter((i) => i.status === "unscheduled").length,
  };

  const filtered = items.filter((i) => {
    if (clientFilter !== "all" && i.client.id !== clientFilter) return false;
    if (campaignFilter !== "all" && i.campaign.id !== campaignFilter) return false;
    if (
      responsible !== "all" &&
      effectiveRole(i.client, i.campaign, "phoenixLeaderId", team)?.id !== responsible &&
      effectiveRole(i.client, i.campaign, "phoenixCoachId", team)?.id !== responsible &&
      i.sender?.id !== responsible
    )
      return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay =
        `${i.client.name} ${i.campaign.name} ${i.campaign.code} ${i.series.code} ` +
        `${i.step.code} ${i.step.title} ${i.step.participant.emailSubject}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }

    if (periodActive) {
      if (!i.date) return false;
      const dIso = iso(i.date);
      if (from && dIso < from) return false;
      if (to && dIso > to) return false;
      return true;
    }

    switch (scope) {
      case "today":
        return i.date !== null && iso(i.date) === todayIso;
      case "week":
        return i.date !== null && i.date >= weekStart && i.date <= addDays(weekEnd, 1);
      case "upcoming":
        return i.status === "scheduled";
      case "sent":
        return i.status === "sent";
      case "awaiting":
        return i.status === "unscheduled";
    }
  });

  // sent scope reads best newest-first
  const ordered = scope === "sent" && !periodActive ? [...filtered].reverse() : filtered;

  // group by day (undated items in one group at the end)
  const groups: Array<{ label: string; items: MailboxItem[] }> = [];
  for (const item of ordered) {
    const label = item.date ? dayLabel(item.date, today) : "No date yet — session not planned";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  const campaignOptions = clients
    .filter((c) => clientFilter === "all" || c.id === clientFilter)
    .flatMap((c) => c.campaigns.map((cp) => ({ value: cp.id, label: `${c.shortName} · ${cp.code}` })));

  const scopeTabs: Array<{ key: Scope; label: string }> = [
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "upcoming", label: "Upcoming" },
    { key: "sent", label: "Sent" },
    { key: "awaiting", label: "No date" },
  ];

  return (
    <>
      <PageHeader
        title="Mailbox"
        subtitle="Every communication that goes out to members — sent by the system from the Phoenix Coach's address. What's leaving today, this week, and what still needs a date."
      />

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          {scopeTabs.map((t) => {
            const on = !periodActive && scope === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setScope(t.key);
                  setFrom("");
                  setTo("");
                }}
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

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-mist">
              Period
            </span>
            <input
              type="date"
              value={from}
              title="Show communications from this date"
              onChange={(e) => setFrom(e.target.value)}
              className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-1.5 py-1 text-[11px] font-semibold tabular-nums focus:border-white/30 focus:outline-none"
            />
            <span className="text-xs text-mist">→</span>
            <input
              type="date"
              value={to}
              title="…until this date"
              onChange={(e) => setTo(e.target.value)}
              className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-1.5 py-1 text-[11px] font-semibold tabular-nums focus:border-white/30 focus:outline-none"
            />
            {periodActive && (
              <button
                data-tip="Clear the period and go back to the tabs"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                className="cursor-pointer rounded p-1 text-mist hover:bg-white/10 hover:text-paper"
              >
                <X size={12} />
              </button>
            )}
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-mist">
              Client
            </span>
            <select
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setCampaignFilter("all");
              }}
              className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              <option value="all">All</option>
              {clients
                .filter((c) => c.campaigns.length > 0)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-mist">
              Campaign
            </span>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              <option value="all">All</option>
              {campaignOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-mist">
              Responsible
            </span>
            <select
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              <option value="all">Anyone</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
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
              placeholder="Search…"
              title="Search by client, campaign, lesson or subject"
              className="w-40 rounded-lg border border-white/10 bg-navy/60 py-1.5 pl-7 pr-2.5 text-xs focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Outbox */}
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-mist">
              {group.label}
              <span className="font-medium normal-case tracking-normal text-mist/60">
                · {group.items.length} communication{group.items.length === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="card overflow-visible">
              <ul className="divide-y divide-white/5">
                {group.items.map((item) => {
                  const key = `${item.campaign.id}-${item.step.id}`;
                  const isOpen = openKey === key;
                  const same =
                    JSON.stringify(item.step.participant) ===
                    JSON.stringify(item.step.leader);
                  return (
                    <li key={key}>
                      <button
                        onClick={() => setOpenKey(isOpen ? null : key)}
                        className="flex w-full cursor-pointer items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/4"
                      >
                        <div className="w-12 shrink-0 text-center">
                          <p className="text-[10px] font-bold uppercase text-mist">
                            {item.date ? fmtWeekday(item.date) : "—"}
                          </p>
                          <p className="text-xs font-bold tabular-nums">
                            {item.date ? fmtDateShort(item.date) : "?"}
                          </p>
                          <p className="text-[10px] tabular-nums text-mist">
                            {item.step.sendTime}
                          </p>
                        </div>

                        <div
                          className="h-10 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: item.series.color }}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {item.step.participant.emailSubject}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-mist">
                            <span className="font-semibold text-paper/80">
                              {item.client.name}
                            </span>
                            <Chip color="#a3a4f0">{item.campaign.code}</Chip>
                            <Chip color={item.series.color}>{item.series.code}</Chip>
                            <span>{item.step.code} · {item.step.title}</span>
                          </p>
                        </div>

                        <span
                          data-tip="Goes to the Participant and Leader variants in tandem"
                          className="hidden shrink-0 items-center gap-1 text-[11px] text-mist xl:flex"
                        >
                          <Users size={12} />
                          {item.client.members.length || "—"}
                        </span>

                        {item.sender ? (
                          <span
                            data-tip={`Sender: ${item.sender.email} (${item.sender.role})`}
                            className="hidden shrink-0 items-center gap-1.5 lg:flex"
                          >
                            <span className="brand-gradient flex size-6 items-center justify-center rounded-full text-[9px] font-bold">
                              {item.sender.initials}
                            </span>
                            <span className="max-w-28 truncate text-xs font-medium">
                              {item.sender.name}
                            </span>
                          </span>
                        ) : (
                          <span
                            data-tip="No responsible assigned to this campaign — assign one so the sender address is known"
                            className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold text-[#ff7a55] lg:flex"
                          >
                            <TriangleAlert size={12} /> no sender
                          </span>
                        )}

                        <span className="shrink-0">
                          <StatusChip
                            status={
                              item.status !== "sent" &&
                              campaignStatus(item.campaign, templates, today) === "paused"
                                ? "paused"
                                : item.status
                            }
                          />
                        </span>

                        <ChevronDown
                          size={15}
                          className={`shrink-0 text-mist transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t border-white/5 px-5 py-4">
                          <p className="mb-3 text-xs text-mist">
                            From{" "}
                            <span className="font-semibold text-paper">
                              {item.sender
                                ? `${item.sender.name} <${item.sender.email}>`
                                : "— no sender assigned —"}
                            </span>{" "}
                            to the members of {item.client.name} ·{" "}
                            {item.campaign.code}
                          </p>
                          <div className={`grid gap-3 ${same ? "" : "lg:grid-cols-2"}`}>
                            {same ? (
                              <VariantPreview
                                label="Participant + Leader (identical)"
                                content={item.step.participant}
                              />
                            ) : (
                              <>
                                <VariantPreview
                                  label="Participant"
                                  content={item.step.participant}
                                />
                                <VariantPreview
                                  label="Leader"
                                  content={item.step.leader}
                                  leader
                                />
                              </>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
                            <Link
                              href={`/campaigns/${item.campaign.id}`}
                              className="text-xs font-semibold text-mist transition-colors hover:text-paper"
                            >
                              Open campaign →
                            </Link>
                            <Link
                              href={`/settings/campaigns/${item.series.campaignTemplateId}/series/${item.series.id}`}
                              className="text-xs font-semibold text-mist transition-colors hover:text-paper"
                            >
                              Edit this email →
                            </Link>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <div className="card flex flex-col items-center gap-2 p-12 text-center">
            <Inbox size={22} className="text-mist/50" />
            <p className="text-sm text-mist">
              Nothing here — no communications match these filters.
            </p>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-4 text-xs text-mist">
          {filtered.length} communication{filtered.length === 1 ? "" : "s"} shown ·
          each goes out as two variants (Participant + Leader) from the
          responsible&rsquo;s address.
        </p>
      )}
    </>
  );
}
