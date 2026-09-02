"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Crown,
  ExternalLink,
  Inbox,
  Paperclip,
  Search,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { TestSendButton } from "@/components/test-send";
import { EditableText } from "@/components/editable";
import { PageHeader, Chip, StatusChip } from "@/components/ui";
import { useData } from "@/lib/state";
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
type SendStatus = "sent" | "scheduled" | "unscheduled" | "paused";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const DOT: Record<SendStatus, { color: string; tip: string }> = {
  sent: { color: "var(--tone-green)", tip: "Sent — this email has already gone out" },
  scheduled: { color: "var(--tone-indigo)", tip: "Scheduled — sends automatically on its date" },
  unscheduled: { color: "var(--color-mist)", tip: "Awaiting date — its trigger session isn't planned yet" },
  paused: { color: "var(--tone-yellow)", tip: "Paused — on hold until the campaign reopens" },
};

function ContentLinks({ content }: { content: StepContent }) {
  if (!content.lesson && !content.extras?.length && !content.attachment) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {content.lesson &&
        (content.lesson.url ? (
          <a
            href={content.lesson.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] font-medium text-mist transition-colors hover:bg-white/10 hover:text-paper"
          >
            <ExternalLink size={11} /> {content.lesson.label}
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#eb320f]/15 px-2.5 py-1 text-[11px] font-semibold text-[#ff7a55]">
            <TriangleAlert size={11} /> {content.lesson.label} — link missing
          </span>
        ))}
      {content.attachment && (
        <span
          data-tip={
            content.attachment.url
              ? "This file travels with the email as an attachment"
              : "Attachment named but its link is missing — it will NOT be attached"
          }
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium ${
            content.attachment.url
              ? "bg-white/5 text-mist"
              : "bg-[#eb320f]/15 font-semibold text-[#ff7a55]"
          }`}
        >
          <Paperclip size={11} /> {content.attachment.label}
        </span>
      )}
      {content.extras?.map((x) =>
        x.url ? (
          <a
            key={x.label}
            href={x.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] font-medium text-mist transition-colors hover:bg-white/10 hover:text-paper"
          >
            <ExternalLink size={11} /> {x.label}
          </a>
        ) : null
      )}
    </div>
  );
}

/** The right pane: one email in full, like any email client. */
function ReadingPane({ item, paused }: { item: MailboxItem; paused: boolean }) {
  const { dispatch } = useData();
  const [variant, setVariant] = useState<"participant" | "leader">("participant");
  const same =
    JSON.stringify(item.step.participant) === JSON.stringify(item.step.leader);
  const content = same ? item.step.participant : item.step[variant];
  const status: SendStatus = paused ? "paused" : item.status;

  // Subject and text are edited right here, in the email being read.
  // Changes go into the master lesson, so every campaign that sends this
  // lesson sends the new wording.
  const patchContent = (patch: Partial<StepContent>) => {
    const variants = same ? (["participant", "leader"] as const) : [variant];
    for (const v of variants)
      dispatch({
        type: "updateStepContent",
        templateId: item.series.id,
        stepId: item.step.id,
        variant: v,
        patch,
      });
  };

  return (
    <div className="flex min-h-full flex-col p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          data-tip="Click the subject to change it — saves when you click away, for every campaign using this lesson"
          data-tip-pos="bottom"
          className="min-w-0 flex-1 text-lg font-bold leading-snug"
        >
          <EditableText
            value={content.emailSubject}
            placeholder="Subject line"
            onCommit={(v) => patchContent({ emailSubject: v })}
            className="text-lg font-bold leading-snug"
          />
        </h2>
        <StatusChip status={status} />
      </div>

      {/* email headers */}
      <dl className="mt-4 flex flex-col gap-1.5 border-y border-white/8 py-3 text-xs">
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 font-bold text-mist/70">
            From
          </dt>
          <dd className="min-w-0">
            {item.from ? (
              <span className="font-semibold">
                {item.from.name}{" "}
                <span className="font-normal text-mist">
                  &lt;{item.from.address}&gt; · {item.from.role}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#ff7a55]">
                <TriangleAlert size={12} /> no sender — assign a responsible to
                this campaign
              </span>
            )}
          </dd>
        </div>
        {/* a client's own champion sends under their name from our domain,
            so the reply address is the one that differs — show it */}
        {item.from?.isClientMember && (
          <div className="flex gap-2">
            <dt className="w-12 shrink-0 font-bold text-mist/70">Reply</dt>
            <dd className="min-w-0 text-mist">
              {item.from.replyTo}{" "}
              <span className="text-mist/60">
                — replies go to {item.from.name} at {item.client.name}
              </span>
            </dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 font-bold text-mist/70">
            To
          </dt>
          <dd className="min-w-0 text-mist">
            Members of{" "}
            <span className="font-semibold text-paper">{item.client.name}</span>{" "}
            · {item.campaign.name}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 font-bold text-mist/70">
            Date
          </dt>
          <dd className="min-w-0 text-mist">
            {item.date
              ? `${fmtWeekday(item.date)} ${fmtDate(item.date)} at ${item.step.sendTime}`
              : "No date yet — the trigger session isn't planned"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 font-bold text-mist/70">
            Series
          </dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Chip color={item.series.color}>{item.series.code}</Chip>
            <span className="text-mist">
              {item.step.code} · {item.step.title}
            </span>
          </dd>
        </div>
      </dl>

      {/* the two audience variants of this send */}
      {!same && (
        <div className="mt-4 flex w-fit divide-x divide-white/8 rounded-md border border-white/10">
          {(["participant", "leader"] as const).map((v) => {
            const on = variant === v;
            return (
              <button
                key={v}
                onClick={() => setVariant(v)}
                data-tip={
                  v === "leader"
                    ? "What the Leader receives — with the Leaders Guides"
                    : "What Participants receive"
                }
                className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-colors first:rounded-l-[5px] last:rounded-r-[5px] ${
                  on ? "bg-white/8 text-paper" : "text-mist hover:text-paper"
                }`}
              >
                {v === "leader" ? (
                  <Crown size={11} className="text-[#ff7a55]" />
                ) : (
                  <Users size={11} />
                )}
                {v === "leader" ? "Leader" : "Participant"}
              </button>
            );
          })}
        </div>
      )}
      {same && (
        <p className="mt-4 flex w-fit items-center gap-1.5 text-[11px] font-semibold text-mist">
          <Users size={11} /> Participant + Leader receive the same email
        </p>
      )}

      {/* body */}
      <div
        className="mt-3 flex-1"
        data-tip="Click the text to change it — saves when you click away, for every campaign using this lesson"
        data-tip-pos="bottom"
      >
        <EditableText
          multiline
          value={content.emailBody}
          placeholder="The email text"
          onCommit={(v) => patchContent({ emailBody: v })}
          className="text-sm leading-relaxed text-paper/90"
        />
        {content.teamMeeting && (
          <p className="mt-3 w-fit rounded-md bg-[#facc15]/10 px-3 py-2 text-xs font-semibold text-[#facc15]">
            TEAM MEETING — {content.teamMeeting}
          </p>
        )}
        <div className="mt-4">
          <ContentLinks content={content} />
        </div>
        {content.note && (
          <p className="mt-3 text-[11px] italic text-mist/70">{content.note}</p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
        <TestSendButton
          campaignId={item.campaign.id}
          stepId={item.step.id}
          variant={same ? "participant" : variant}
        />
        <Link
          href={`/campaigns/${item.campaign.id}`}
          data-tip="Go to this campaign's page"
          className="text-xs font-semibold text-mist transition-colors hover:text-paper"
        >
          Open campaign →
        </Link>
        <Link
          href={`/settings/campaigns/${item.series.campaignTemplateId}/series/${item.series.id}`}
          data-tip="Change the subject, text and links in the blueprint"
          className="text-xs font-semibold text-mist transition-colors hover:text-paper"
        >
          Edit this email →
        </Link>
      </div>
    </div>
  );
}

export default function MailboxPage() {
  const { clients, templates, staff } = useData();
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
    () => mailboxItems(clients, templates, staff, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, templates, staff]
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
      effectiveRole(i.client, i.campaign, "phoenixLeaderId", staff)?.id !== responsible &&
      effectiveRole(i.client, i.campaign, "phoenixCoachId", staff)?.id !== responsible &&
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

  const keyOf = (i: MailboxItem) => `${i.campaign.id}-${i.step.id}`;
  const isPaused = (i: MailboxItem) =>
    i.status !== "sent" && campaignStatus(i.campaign, templates, today) === "paused";
  // the open email — falls back to the first in the list, like a mailbox
  const selected = ordered.find((i) => keyOf(i) === openKey) ?? ordered[0] ?? null;

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
        subtitle="Every communication that goes out to members — sent by the system from the Phoenix Coach's address."
      />

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          {scopeTabs.map((t) => {
            const on = !periodActive && scope === t.key;
            return (
              <button
                key={t.key}
                data-tip={{
                  today: "Emails going out today",
                  week: "Everything leaving this week",
                  upcoming: "All scheduled future sends",
                  sent: "What has already gone out",
                  awaiting: "Sends whose trigger session has no date yet",
                }[t.key]}
                onClick={() => {
                  setScope(t.key);
                  setFrom("");
                  setTo("");
                }}
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

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-mist">
              Period
            </span>
            <input
              type="date"
              value={from}
              title="Show communications from this date"
              onChange={(e) => setFrom(e.target.value)}
              className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-1.5 py-1 text-[11px] font-semibold tabular-nums focus:border-white/30 focus:outline-none"
            />
            <span className="text-xs text-mist">→</span>
            <input
              type="date"
              value={to}
              title="…until this date"
              onChange={(e) => setTo(e.target.value)}
              className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-1.5 py-1 text-[11px] font-semibold tabular-nums focus:border-white/30 focus:outline-none"
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
            <span className="text-[11px] font-medium text-mist">
              Client
            </span>
            <select
              title="Show only this client's emails"
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setCampaignFilter("all");
              }}
              className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
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
            <span className="text-[11px] font-medium text-mist">
              Campaign
            </span>
            <select
              title="Show only this campaign's emails"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
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
            <span className="text-[11px] font-medium text-mist">
              Responsible
            </span>
            <select
              title="Show only emails this person is responsible for"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              <option value="all">Anyone</option>
              {staff.map((t) => (
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
              className="w-40 rounded-md border border-white/10 bg-navy/60 py-1.5 pl-7 pr-2.5 text-xs focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Mailbox: the list on the left, the open email on the right */}
      {ordered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <Inbox size={22} className="text-mist/50" />
          <p className="text-sm text-mist">
            Nothing here — no communications match these filters.
          </p>
        </div>
      ) : (
        <div className="card grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ul className="border-b border-white/8 lg:border-b-0 lg:border-r">
            {ordered.map((item) => {
              const k = keyOf(item);
              const on = selected !== null && keyOf(selected) === k;
              const dot = DOT[isPaused(item) ? "paused" : item.status];
              return (
                <li key={k} className="border-b border-white/5 last:border-b-0">
                  <button
                    data-tip="Read this email in full on the right"
                    data-tip-pos="bottom"
                    onClick={() => setOpenKey(k)}
                    className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors ${
                      on ? "bg-white/6" : "hover:bg-white/4"
                    }`}
                  >
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: item.series.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[13px] ${
                            on ? "font-bold" : "font-semibold"
                          }`}
                        >
                          {item.step.participant.emailSubject}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-mist">
                          {item.date ? fmtDateShort(item.date) : "no date"}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-mist">
                          {item.client.name} · {item.campaign.code} ·{" "}
                          {item.step.code}
                        </span>
                        <span
                          data-tip={dot.tip}
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: dot.color }}
                        />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-h-96 self-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            {selected && (
              <ReadingPane
                key={keyOf(selected)}
                item={selected}
                paused={isPaused(selected)}
              />
            )}
          </div>
        </div>
      )}

      {ordered.length > 0 && (
        <p className="mt-4 text-xs text-mist">
          {ordered.length} communication{ordered.length === 1 ? "" : "s"} in this
          view · each goes out as two variants (Participant + Leader) from the
          responsible&rsquo;s address.
        </p>
      )}
    </>
  );
}
