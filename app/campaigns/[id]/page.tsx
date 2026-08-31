"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  GripVertical,
  Layers,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Chip, ProgressBar, GhostButton, StatusChip } from "@/components/ui";
import { EditableText } from "@/components/editable";
import { TestSendButton } from "@/components/test-send";
import { MemberPicker } from "@/components/member-picker";
import { daysBetweenIso, useData } from "@/lib/state";
import { useConfirm } from "@/components/confirm";
import {
  computeSchedule,
  emailSenderFor,
  findCampaign,
  findStaff,
  findTemplate,
  senderFor,
  seriesProgress,
  campaignCompletion,
  campaignStatus,
  triggerSession,
  fmtDate,
  fmtDateShort,
  fmtWeekday,
} from "@/lib/store";
import type {
  CampaignSession,
  CampaignStatus,
  ClientAssignmentRole,
  PhoenixAssignmentRole,
} from "@/lib/types";

const STATUS_STYLE: Record<CampaignStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: "rgba(74,222,128,0.14)", fg: "#4ade80", label: "Active" },
  upcoming: { bg: "rgba(235,50,15,0.16)", fg: "#ff7a55", label: "Upcoming" },
  paused: { bg: "rgba(250,204,21,0.15)", fg: "#facc15", label: "Paused" },
  closed: { bg: "rgba(174,176,178,0.14)", fg: "#aeb0b2", label: "Closed" },
};

const STATUS_ORDER: CampaignStatus[] = ["upcoming", "active", "paused", "closed"];

/** Where a session sits in time. One colour each, nothing else. */
const SESSION_STATE = {
  past: { color: "#7c7e8c", label: "Done", tip: "Already happened" },
  next: { color: "#4ade80", label: "Next", tip: "The next session — this is what's coming up" },
  later: { color: "#6ea8ff", label: "Ahead", tip: "Still ahead, after the next one" },
  undated: { color: "#aeb0b2", label: "No date", tip: "No date yet — its series can't be scheduled" },
} as const;

const STATUS_TIP: Record<CampaignStatus, string> = {
  upcoming: "Hasn't started yet — the first sends are still ahead",
  active: "Running — scheduled emails go out",
  paused: "Pause the campaign — every send is on hold until you reopen it",
  closed: "Finished — nothing more will be sent",
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/Brussels",
];

/** Small inline select that reads as text until you use it. */
function InlineSelect({
  label,
  value,
  onChange,
  options,
  tip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  tip?: string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-mist">
        {label}
      </span>
      <select
        title={tip}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1 text-xs font-semibold text-paper focus:border-white/30 focus:outline-none"
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

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { clients, templates, staff: team, dispatch } = useData();
  const confirmDelete = useConfirm();
  const [pickingModule, setPickingModule] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [seriesDragId, setSeriesDragId] = useState<string | null>(null);
  const [seriesOverIndex, setSeriesOverIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingMember, setAddingMember] = useState(false);
  // a just-clicked + renders an empty row; the record is only created
  // once a person is actually chosen
  const [pendingClientRow, setPendingClientRow] = useState(false);
  const [pendingPhoenixRow, setPendingPhoenixRow] = useState(false);
  const [newMember, setNewMember] = useState({ first: "", last: "", title: "", email: "" });
  const [sessionView, setSessionView] = useState<"gallery" | "list">("gallery");
  // set after a session is rescheduled, offering to carry the rest along
  const [shift, setShift] = useState<{
    sessionId: string;
    name: string;
    days: number;
    count: number;
  } | null>(null);
  const today = new Date();

  const found = findCampaign(clients, id);

  if (!found) {
    return (
      <div className="card p-10 text-center text-sm text-mist">
        Campaign not found.{" "}
        <Link href="/campaigns" className="font-semibold text-paper underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const { client, campaign } = found;
  const completion = campaignCompletion(campaign, templates, today);
  const status = campaignStatus(campaign, templates, today);
  const unloaded = templates.filter(
    (t) => !campaign.series.some((s) => s.templateId === t.id)
  );

  // send counts across the whole campaign
  let sent = 0;
  let scheduled = 0;
  let waiting = 0;
  for (const loaded of campaign.series) {
    const series = findTemplate(templates, loaded.templateId);
    if (!series) continue;
    for (const item of computeSchedule(campaign, loaded, series, today)) {
      if (item.status === "sent") sent++;
      else if (item.status === "scheduled") scheduled++;
      else waiting++;
    }
  }
  const datedSessions = campaign.sessions.filter((s) => s.date).length;
  const phoenixSender = senderFor(client, campaign, team);
  const emailSender = emailSenderFor(client, campaign, team);

  const staffOptions = [
    { value: "", label: "— unassigned —" },
    ...team.map((t) => ({ value: t.id, label: t.name })),
  ];

  const datedSessionCount = campaign.sessions.filter((s) => s.date).length;
  // the soonest session still ahead — the one the team is working towards
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const nextSessionId =
    campaign.sessions
      .filter((s) => s.date && s.date >= todayIso)
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0]?.id ?? null;

  /** Where a session stands, which is all the colour on the card means. */
  const sessionState = (s: CampaignSession): keyof typeof SESSION_STATE => {
    if (!s.date) return "undated";
    if (s.id === nextSessionId) return "next";
    return s.date < todayIso ? "past" : "later";
  };
  const patternedCount = campaign.sessions.filter(
    (s) => typeof s.offsetDays === "number"
  ).length;

  /** Every date input for a session goes through here, wherever it sits on
   *  the page, so rescheduling always offers to move the rest with it. */
  const setSessionDate = (session: CampaignSession, next: string) => {
    const value = next || null;
    // a session that already carries a day number keeps it truthful, so
    // filling the dates again lands on the same day
    const keepsPattern =
      typeof session.offsetDays === "number" && campaign.startDate && value;
    dispatch({
      type: "updateSession",
      clientId: client.id,
      campaignId: campaign.id,
      sessionId: session.id,
      patch: keepsPattern
        ? { date: value, offsetDays: daysBetweenIso(campaign.startDate!, value!) }
        : { date: value },
    });
    const index = campaign.sessions.findIndex((s) => s.id === session.id);
    const later = campaign.sessions.slice(index + 1).filter((s) => s.date).length;
    const days =
      session.date && value ? daysBetweenIso(session.date, value) : 0;
    setShift(
      days !== 0 && later > 0
        ? { sessionId: session.id, name: session.name, days, count: later }
        : null
    );
  };

  const endDrag = () => {
    setDragId(null);
    setOverIndex(null);
  };

  /** Reorder-by-drag, shared by the card view and the list view. */
  const dragProps = (sessionId: string, index: number) => ({
    onDragStart: (e: React.DragEvent) => {
      setDragId(sessionId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", sessionId);
    },
    onDragEnd: endDrag,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (overIndex !== index) setOverIndex(index);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const moved = e.dataTransfer.getData("text/plain") || dragId;
      if (moved) {
        dispatch({
          type: "moveSessionTo",
          clientId: client.id,
          campaignId: campaign.id,
          sessionId: moved,
          toIndex: index,
        });
      }
      endDrag();
    },
  });

  const endSeriesDrag = () => {
    setSeriesDragId(null);
    setSeriesOverIndex(null);
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <Link
        href="/campaigns"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> All campaigns
      </Link>

      {/* Header: title, client, owners */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <Chip color="#a3a4f0">{campaign.code}</Chip>
          </div>
          <p className="mt-1 text-sm text-mist">
            <Link href={`/clients/${client.id}`} className="hover:text-paper hover:underline">
              {client.name}
            </Link>{" "}
            · {client.members.length} members
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* status: all four always visible, each in its own color */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-mist">
              Status
            </span>
            <div className="flex divide-x divide-white/8 rounded-md border border-white/10">
              {STATUS_ORDER.map((s) => {
                const on = s === status;
                const st = STATUS_STYLE[s];
                return (
                  <button
                    key={s}
                    data-tip={STATUS_TIP[s]}
                    data-tip-pos="bottom"
                    onClick={() => {
                      // picking the status the schedule already derives goes
                      // back to automatic; anything else is a manual override
                      const derived = campaignStatus(
                        { ...campaign, statusOverride: undefined },
                        templates,
                        today
                      );
                      dispatch({
                        type: "updateCampaign",
                        clientId: client.id,
                        campaignId: campaign.id,
                        patch: { statusOverride: s === derived ? undefined : s },
                      });
                    }}
                    data-on={on}
                    className="status-seg cursor-pointer px-2.5 py-1 text-[11px] font-bold transition-colors first:rounded-l-[5px] last:rounded-r-[5px]"
                    style={{ "--chip-c": st.fg } as CSSProperties}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="seg-dot size-1.5 rounded-full"
                        style={{ opacity: on ? 1 : 0.45 }}
                      />
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <InlineSelect
            label="Timezone"
            tip="The client's timezone — send times apply in this zone"
            value={campaign.timezone}
            onChange={(v) =>
              dispatch({
                type: "updateCampaign",
                clientId: client.id,
                campaignId: campaign.id,
                patch: { timezone: v || "America/New_York" },
              })
            }
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
          />
        </div>
      </div>

      {/* Progress overview */}
      <section className="card mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-mist">
              Campaign progress
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {completion.pct}%
              <span className="ml-2 text-sm font-medium text-mist">
                {completion.sent} of {completion.total} lessons sent
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#4ade80]" />
              <span className="font-bold tabular-nums">{sent}</span>
              <span className="text-mist">sent</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#a3a4f0]" />
              <span className="font-bold tabular-nums">{scheduled}</span>
              <span className="text-mist">scheduled</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-white/20" />
              <span className="font-bold tabular-nums">{waiting}</span>
              <span className="text-mist">awaiting a date</span>
            </span>
            <span className="flex items-center gap-1.5 text-mist">
              <CalendarDays size={13} />
              <span className="font-bold tabular-nums text-paper">
                {datedSessions}/{campaign.sessions.length}
              </span>
              sessions dated
            </span>
            <span className="flex items-center gap-1.5 text-mist">
              <span>Runs</span>
              <input
                type="date"
                title="Campaign start date — shown as a milestone in the Calendar"
                value={campaign.startDate ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "updateCampaign",
                    clientId: client.id,
                    campaignId: campaign.id,
                    patch: { startDate: e.target.value || null },
                  })
                }
                className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-1.5 py-1 text-[11px] font-bold tabular-nums text-paper focus:border-white/30 focus:outline-none"
              />
              <span>→</span>
              <input
                type="date"
                title="Campaign end date — shown as a milestone in the Calendar"
                value={campaign.endDate ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "updateCampaign",
                    clientId: client.id,
                    campaignId: campaign.id,
                    patch: { endDate: e.target.value || null },
                  })
                }
                className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-1.5 py-1 text-[11px] font-bold tabular-nums text-paper focus:border-white/30 focus:outline-none"
              />
            </span>
          </div>
        </div>

        {/* segmented bar: sent | scheduled | waiting */}
        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-white/8">
          {sent > 0 && (
            <div
              className="h-full bg-[#4ade80]"
              style={{ width: `${(sent / Math.max(1, sent + scheduled + waiting)) * 100}%` }}
            />
          )}
          {scheduled > 0 && (
            <div
              className="h-full bg-[#a3a4f0]"
              style={{
                width: `${(scheduled / Math.max(1, sent + scheduled + waiting)) * 100}%`,
              }}
            />
          )}
        </div>
      </section>

      {/* Campaign team — same add-person system on both sides */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Phoenix side */}
        <section className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-bold">
              Phoenix team{" "}
              <span className="text-sm font-medium text-mist">
                ({campaign.phoenixTeam.length})
              </span>
            </h2>
            <button
              data-tip="Add a Phoenix collaborator to this campaign"
              onClick={() => setPendingPhoenixRow(true)}
              className="cursor-pointer rounded-md border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
            >
              <Plus size={14} />
            </button>
          </div>
          <p className="mb-4 text-xs text-mist">
            Who at Phoenix works on this campaign — any number of people, each
            with a role. The Coach is the one the emails are sent from.
          </p>

          {campaign.phoenixTeam.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_9.5rem_1.75rem] gap-2 border-b border-white/8 pb-1 text-[11px] font-medium text-mist">
              <span>Name</span>
              <span>Role</span>
              <span />
            </div>
          )}
          <div className="flex flex-col">
            {campaign.phoenixTeam.map((a) => {
              const person = findStaff(team, a.staffId);
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[minmax(0,1fr)_9.5rem_1.75rem] items-center gap-2 border-b border-white/5 py-1.5 last:border-b-0"
                >
                  <select
                    title="Which Phoenix collaborator"
                    value={a.staffId}
                    onChange={(e) =>
                      dispatch({
                        type: "updatePhoenixAssignment",
                        clientId: client.id,
                        campaignId: campaign.id,
                        assignmentId: a.id,
                        patch: { staffId: e.target.value },
                      })
                    }
                    className="min-w-0 cursor-pointer rounded border border-transparent bg-transparent px-1 py-1 text-xs font-semibold transition-colors hover:border-white/15 hover:bg-navy/60 focus:border-white/30 focus:bg-navy/60 focus:outline-none"
                  >
                    {team.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    title="Their role on this campaign"
                    value={a.role}
                    onChange={(e) =>
                      dispatch({
                        type: "updatePhoenixAssignment",
                        clientId: client.id,
                        campaignId: campaign.id,
                        assignmentId: a.id,
                        patch: { role: e.target.value as PhoenixAssignmentRole },
                      })
                    }
                    className="min-w-0 cursor-pointer rounded border border-transparent bg-transparent px-1 py-1 text-xs text-mist transition-colors hover:border-white/15 hover:bg-navy/60 focus:border-white/30 focus:bg-navy/60 focus:outline-none"
                  >
                    <option value="phoenix_leader">Phoenix Leader</option>
                    <option value="phoenix_coach">Phoenix Coach</option>
                    <option value="project_manager">Project Manager</option>
                  </select>
                  <button
                    data-tip="Remove this assignment"
                    onClick={async () => {
                      if (
                        await confirmDelete({
                          name: person?.name ?? "this assignment",
                          detail: "Takes them off this campaign only — they stay on the team and on the client.",
                          verb: "Remove",
                        })
                      )
                        dispatch({
                          type: "removePhoenixAssignment",
                          clientId: client.id,
                          campaignId: campaign.id,
                          assignmentId: a.id,
                        });
                    }}
                    className="cursor-pointer justify-self-end rounded p-1 text-mist/60 transition-colors hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
            {pendingPhoenixRow && (
              <div className="grid grid-cols-[minmax(0,1fr)_9.5rem_1.75rem] items-center gap-2 border-b border-white/5 py-1.5 last:border-b-0">
                <select
                  autoFocus
                  data-tip="Choose who joins this campaign — nothing is saved until you do"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    dispatch({
                      type: "addPhoenixAssignment",
                      clientId: client.id,
                      campaignId: campaign.id,
                      staffId: e.target.value,
                      role: "phoenix_coach",
                    });
                    setPendingPhoenixRow(false);
                  }}
                  className="min-w-0 cursor-pointer rounded border border-white/20 bg-navy/60 px-1 py-1 text-xs focus:border-white/30 focus:outline-none"
                >
                  <option value="">— choose a person —</option>
                  {[...team]
                    .sort((x, y) => x.name.localeCompare(y.name))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <span className="text-xs text-mist/50">then pick a role</span>
                <button
                  data-tip="Never mind"
                  onClick={() => setPendingPhoenixRow(false)}
                  className="cursor-pointer justify-self-end rounded p-1 text-mist/60 hover:bg-white/10 hover:text-paper"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            {campaign.phoenixTeam.length === 0 && !pendingPhoenixRow && (
              <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-center text-xs text-mist">
                No one assigned yet — the client defaults apply
                {(() => {
                  const d = [
                    findStaff(team, client.phoenixLeaderId),
                    findStaff(team, client.phoenixCoachId),
                    findStaff(team, client.projectManagerId),
                  ]
                    .filter(Boolean)
                    .map((x) => x!.name);
                  return d.length ? ` (${[...new Set(d)].join(", ")})` : "";
                })()}
                .
              </p>
            )}
          </div>
        </section>

        {/* Client side — same system */}
        <section className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-bold">
              Client team{" "}
              <span className="text-sm font-medium text-mist">
                ({campaign.clientTeam.length})
              </span>
            </h2>
            <button
              data-tip={
                client.members.length === 0
                  ? "Add the first person at this client"
                  : "Add a client member to this campaign"
              }
              onClick={() => {
                // no members yet? then the person has to be created first,
                // right here — sending you to another page loses your place
                if (client.members.length === 0) setAddingMember(true);
                else setPendingClientRow(true);
              }}
              className="cursor-pointer rounded-md border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
            >
              <Plus size={14} />
            </button>
          </div>
          <p className="mb-4 text-xs text-mist">
            Who at the client is responsible — chosen from the client&rsquo;s
            members, each with a role, e.g. the Client Transformational Champion.
          </p>

          {campaign.clientTeam.length > 0 && (
            <div className="grid grid-cols-[1.4rem_minmax(0,1.1fr)_minmax(0,1.3fr)_8.5rem_1.75rem] gap-2 border-b border-white/8 pb-1 text-[11px] font-medium text-mist">
              <span>#</span>
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span />
            </div>
          )}
          <div className="flex flex-col">
            {/* about five rows tall; the rest scrolls */}
            <div className="flex max-h-[11.5rem] flex-col overflow-y-auto pr-1">
            {[...campaign.clientTeam]
              .sort((x, y) => {
                const nx = client.members.find((m) => m.id === x.memberId)?.name ?? "";
                const ny = client.members.find((m) => m.id === y.memberId)?.name ?? "";
                return nx.localeCompare(ny);
              })
              .map((a, rowIndex) => {
              const member = client.members.find((m) => m.id === a.memberId);
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[1.4rem_minmax(0,1.1fr)_minmax(0,1.3fr)_8.5rem_1.75rem] items-center gap-2 border-b border-white/5 py-1.5 last:border-b-0"
                >
                  <span className="text-[11px] tabular-nums text-mist/60">
                    {rowIndex + 1}
                  </span>
                  <MemberPicker
                    nameOnly
                    tip="Which member of the client — type to search"
                    members={client.members}
                    excludeIds={campaign.clientTeam.map((x) => x.memberId)}
                    value={a.memberId}
                    onPick={(memberId) =>
                      dispatch({
                        type: "updateClientAssignment",
                        clientId: client.id,
                        campaignId: campaign.id,
                        assignmentId: a.id,
                        patch: { memberId },
                      })
                    }
                  />
                  <span
                    data-tip={member?.email || "No email address yet — add it on the client page"}
                    className={`truncate text-xs ${member?.email ? "text-mist" : "font-semibold text-[#ff7a55]"}`}
                  >
                    {member?.email || "no email"}
                  </span>
                  <select
                    title="Their role on this campaign"
                    value={a.role}
                    onChange={(e) =>
                      dispatch({
                        type: "updateClientAssignment",
                        clientId: client.id,
                        campaignId: campaign.id,
                        assignmentId: a.id,
                        patch: { role: e.target.value as ClientAssignmentRole },
                      })
                    }
                    className="min-w-0 cursor-pointer rounded border border-transparent bg-transparent px-1 py-1 text-xs text-mist transition-colors hover:border-white/15 hover:bg-navy/60 focus:border-white/30 focus:bg-navy/60 focus:outline-none"
                  >
                    <option value="contact">Team member</option>
                    <option value="champion">Transf. Champion</option>
                  </select>
                  <button
                    data-tip="Remove this assignment"
                    onClick={async () => {
                      if (
                        await confirmDelete({
                          name: member?.name ?? "this assignment",
                          detail: `Takes them off this campaign's team only — they stay on ${client.shortName}'s members list.`,
                          verb: "Remove",
                        })
                      )
                        dispatch({
                          type: "removeClientAssignment",
                          clientId: client.id,
                          campaignId: campaign.id,
                          assignmentId: a.id,
                        });
                    }}
                    className="cursor-pointer justify-self-end rounded p-1 text-mist/60 transition-colors hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
            </div>
            {pendingClientRow && (
              <div className="grid grid-cols-[1.4rem_minmax(0,1.1fr)_minmax(0,1.3fr)_8.5rem_1.75rem] items-center gap-2 border-b border-white/5 py-1.5 last:border-b-0">
                <span className="text-[11px] tabular-nums text-mist/40">+</span>
                <MemberPicker
                  nameOnly
                  tip="Choose who joins this campaign — nothing is saved until you do"
                  members={client.members}
                  excludeIds={campaign.clientTeam.map((x) => x.memberId)}
                  value=""
                  onPick={(memberId) => {
                    dispatch({
                      type: "addClientAssignment",
                      clientId: client.id,
                      campaignId: campaign.id,
                      memberId,
                      role: "contact",
                    });
                    setPendingClientRow(false);
                  }}
                />
                <span className="truncate text-xs text-mist/40">—</span>
                <span className="text-xs text-mist/50">as team member</span>
                <button
                  data-tip="Never mind"
                  onClick={() => setPendingClientRow(false)}
                  className="cursor-pointer justify-self-end rounded p-1 text-mist/60 hover:bg-white/10 hover:text-paper"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            {campaign.clientTeam.length === 0 && !addingMember && !pendingClientRow && (
              <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-center text-xs text-mist">
                No one assigned yet — add the Client Transformational Champion
                with the + above.
              </p>
            )}

            {/* Create a person at the client and put them on this campaign in
                one step — no detour to the client page. */}
            {addingMember && (
              <div className="rounded-md border border-white/10 bg-white/3 p-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    autoFocus
                    value={newMember.first}
                    onChange={(e) =>
                      setNewMember({ ...newMember, first: e.target.value })
                    }
                    placeholder="First name"
                    data-tip="What {{first_name}} in their emails becomes"
                    className="min-w-0 rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs focus:border-white/30 focus:outline-none"
                  />
                  <input
                    value={newMember.last}
                    onChange={(e) =>
                      setNewMember({ ...newMember, last: e.target.value })
                    }
                    placeholder="Last name"
                    className="min-w-0 rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs focus:border-white/30 focus:outline-none"
                  />
                  <input
                    value={newMember.title}
                    onChange={(e) =>
                      setNewMember({ ...newMember, title: e.target.value })
                    }
                    placeholder="Job title"
                    data-tip="Shown beside their name, and used as their role if they ever send the campaign's emails"
                    className="min-w-0 rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs focus:border-white/30 focus:outline-none"
                  />
                  <input
                    type="email"
                    value={newMember.email}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                    placeholder="name@company.com"
                    data-tip="Where their lessons go, and where replies reach them if they are the sender"
                    className="min-w-0 rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs focus:border-white/30 focus:outline-none"
                  />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    disabled={!newMember.first.trim() && !newMember.last.trim()}
                    data-tip="Adds them to this client and puts them on this campaign as a team member"
                    onClick={() => {
                      const first = newMember.first.trim();
                      const last = newMember.last.trim();
                      if (!first && !last) return;
                      const memberId = `member-${Math.random().toString(36).slice(2, 9)}`;
                      dispatch({
                        type: "addMember",
                        id: memberId,
                        clientId: client.id,
                        name: [first, last].filter(Boolean).join(" "),
                        firstName: first,
                        lastName: last,
                        title: newMember.title.trim(),
                        email: newMember.email.trim(),
                        role: "participant",
                      });
                      dispatch({
                        type: "addClientAssignment",
                        clientId: client.id,
                        campaignId: campaign.id,
                        memberId,
                        role: "contact",
                      });
                      setNewMember({ first: "", last: "", title: "", email: "" });
                      setAddingMember(false);
                    }}
                    className="brand-gradient cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add and assign
                  </button>
                  <button
                    onClick={() => setAddingMember(false)}
                    data-tip="Discard this person without adding them"
                    className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
                  >
                    Cancel
                  </button>
                  <span className="text-[11px] text-mist">
                    They join {client.name}&rsquo;s members list too.
                  </span>
                </div>
              </div>
            )}

            {client.members.length > 0 && !addingMember && (
              <button
                onClick={() => setAddingMember(true)}
                data-tip="Create a person at this client and put them on this campaign in one step"
                className="w-fit cursor-pointer text-[11px] font-semibold text-mist underline transition-colors hover:text-paper"
              >
                Someone not on the list yet? Add them here
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Who the emails come from */}
      <section className="card mb-6 p-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Mail size={17} className="text-mist" /> Emails sent by
        </h2>
        <p className="mt-1 mb-4 text-xs text-mist">
          Normally the Phoenix Coach. For a programme introduced from inside
          the client&rsquo;s own organisation, pick their Transformational
          Champion instead — recipients see that person&rsquo;s name and replies
          reach them, while the address stays on our sending domain so the
          emails keep arriving.
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <select
            title="Who this campaign's emails appear to come from"
            value={campaign.senderMemberId ?? ""}
            onChange={(e) =>
              dispatch({
                type: "updateCampaign",
                clientId: client.id,
                campaignId: campaign.id,
                patch: { senderMemberId: e.target.value || null },
              })
            }
            className="min-w-64 cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
          >
            <option value="">
              The Phoenix Coach
              {phoenixSender ? ` — ${phoenixSender.name}` : " — none assigned"}
            </option>
            {client.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.title ? ` — ${m.title}` : ""} (at {client.shortName})
              </option>
            ))}
          </select>

          {emailSender ? (
            <p className="min-w-0 text-xs text-mist">
              Recipients see{" "}
              <span className="font-semibold text-paper">
                {emailSender.name} &lt;{emailSender.address}&gt;
              </span>
              {emailSender.isClientMember && (
                <>
                  {" "}
                  · replies go to{" "}
                  <span className="font-semibold text-paper">
                    {emailSender.replyTo}
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="text-xs font-semibold text-[#ff7a55]">
              No sender yet — assign a Phoenix Coach above, or pick a client
              member.
            </p>
          )}
        </div>

        {emailSender?.isClientMember && !emailSender.replyTo.includes("@") && (
          <p className="mt-3 text-xs font-semibold text-[#ff7a55]">
            {emailSender.name} has no email address — add it on the client page
            so replies have somewhere to go.
          </p>
        )}

        {/* Watching from the outside: one copy per lesson, not per member */}
        <label className="mt-5 block border-t border-white/8 pt-4">
          <span className="text-[11px] font-medium text-mist">
            Send a copy of everything to
          </span>
          <input
            type="text"
            defaultValue={campaign.shadowEmails ?? ""}
            placeholder="amber@phoenixperform.com, someone@else.com"
            data-tip="One copy of each lesson, once — not one per member. They stay off the members list."
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next === (campaign.shadowEmails ?? "").trim()) return;
              dispatch({
                type: "updateCampaign",
                clientId: client.id,
                campaignId: campaign.id,
                patch: { shadowEmails: next || null },
              });
            }}
            className="mt-1 w-full max-w-xl rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs focus:border-white/30 focus:outline-none"
          />
          <span className="mt-1.5 block text-[11px] text-mist">
            Comma-separated. They see every lesson exactly once as it goes out,
            with the client&rsquo;s name in the subject — no personalisation, and
            they never appear in the members list.
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-6">
        {/* Sessions — square, draggable cards */}
        <section className="card p-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <CalendarDays size={17} className="text-mist" /> Sessions
              <span className="text-sm font-medium text-mist">
                ({campaign.sessions.length})
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* what the colours mean */}
              <div className="flex flex-wrap items-center gap-2.5">
                {(["past", "next", "later", "undated"] as const).map((k) => (
                  <span
                    key={k}
                    data-tip={SESSION_STATE[k].tip}
                    className="flex items-center gap-1.5 text-[11px] text-mist"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: SESSION_STATE[k].color }}
                    />
                    {SESSION_STATE[k].label}
                  </span>
                ))}
              </div>
              <div className="flex divide-x divide-white/8 rounded-md border border-white/10">
                {(
                  [
                    { key: "gallery", label: "Cards", Icon: LayoutGrid, tip: "Cards — good for moving sessions around" },
                    { key: "list", label: "List", Icon: List, tip: "List — good for checking the order and the dates" },
                  ] as const
                ).map(({ key, label, Icon, tip }) => (
                  <button
                    key={key}
                    data-tip={tip}
                    onClick={() => setSessionView(key)}
                    className={`flex cursor-pointer items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold transition-colors first:rounded-l-[5px] last:rounded-r-[5px] ${
                      sessionView === key
                        ? "bg-white/8 text-paper"
                        : "text-mist hover:text-paper"
                    }`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mb-4 text-xs text-mist">
            The live and online meetings in this campaign. Drag to reorder — the
            numbering follows. A session&rsquo;s date triggers the series bound to it.
          </p>

          {/* Day numbers — the campaign's rhythm, so a start date dates it all */}
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-white/8 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-xs text-mist">
              <span className="font-semibold text-paper">Day numbers.</span>{" "}
              Each session can carry the number of days after the campaign
              start on which it falls. Fill those in once and the next start
              date dates the whole campaign in one click.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                data-tip={
                  !campaign.startDate
                    ? "Set the campaign start date first (top of this page)"
                    : patternedCount === 0
                      ? "No session has a day number yet — enter them on the cards, or save the current dates as the pattern"
                      : `Date the ${patternedCount} session${patternedCount === 1 ? "" : "s"} that carry a day number`
                }
                disabled={!campaign.startDate || patternedCount === 0}
                onClick={() => {
                  setShift(null);
                  dispatch({
                    type: "fillSessionDates",
                    clientId: client.id,
                    campaignId: campaign.id,
                  });
                }}
                className="brand-gradient cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {campaign.startDate
                  ? `Fill the dates from ${fmtDateShort(new Date(`${campaign.startDate}T00:00:00`))}`
                  : "Fill the dates from the start"}
              </button>
              <button
                data-tip={
                  !campaign.startDate
                    ? "Set the campaign start date first (top of this page)"
                    : "Record how many days after the start each dated session falls, so the same rhythm can be reused"
                }
                disabled={!campaign.startDate || datedSessionCount === 0}
                onClick={() =>
                  dispatch({
                    type: "captureSessionOffsets",
                    clientId: client.id,
                    campaignId: campaign.id,
                  })
                }
                className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save these dates as the pattern
              </button>
            </div>
          </div>

          {sessionView === "gallery" ? (
            <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {campaign.sessions.map((session, i) => {
                const state = sessionState(session);
                const tone = SESSION_STATE[state];
                const boundCount = campaign.series.filter(
                  (s) => s.sessionId === session.id
                ).length;
                const dragging = dragId === session.id;
                const isOver = overIndex === i && dragId !== null && !dragging;

                return (
                  <li
                    key={session.id}
                    draggable
                    {...dragProps(session.id, i)}
                    style={{ "--chip-c": tone.color } as CSSProperties}
                    className={`session-card group relative flex min-h-32 cursor-grab flex-col p-2.5 transition-all active:cursor-grabbing ${
                      state === "past" ? "opacity-60" : ""
                    } ${dragging ? "rotate-3 scale-105 opacity-70 shadow-2xl shadow-flame/20" : ""} ${
                      isOver ? "ring-2 ring-[#ff7a55]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        data-tip={`${tone.tip}. ${
                          boundCount === 0
                            ? "No series hangs off it."
                            : `Triggers ${boundCount} series.`
                        }`}
                        className="flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-navy"
                        style={{ backgroundColor: tone.color }}
                      >
                        {i + 1}
                      </span>
                      <button
                        onClick={() =>
                          dispatch({
                            type: "updateSession",
                            clientId: client.id,
                            campaignId: campaign.id,
                            sessionId: session.id,
                            patch: {
                              mode: session.mode === "virtual" ? "in-person" : "virtual",
                            },
                          })
                        }
                        data-tip="Click to switch between virtual and in person"
                        className="cursor-pointer text-mist transition-colors hover:text-paper"
                      >
                        {session.mode === "virtual" ? (
                          <Video size={11} />
                        ) : (
                          <MapPin size={11} />
                        )}
                      </button>
                      <span className="ml-auto flex items-center gap-0.5">
                        <span data-tip="Drag the card to another position to reorder">
                          <GripVertical
                            size={11}
                            className="text-mist/40 group-hover:text-mist"
                          />
                        </span>
                        <button
                          data-tip="Delete this session — series bound to it fall back to unbound"
                          onClick={async () => {
                            if (
                              await confirmDelete({
                                name: session.name,
                                detail: "Deletes this meeting from the campaign. Series bound to it lose their trigger and stop being scheduled until rebound.",
                              })
                            )
                              dispatch({
                                type: "removeSession",
                                clientId: client.id,
                                campaignId: campaign.id,
                                sessionId: session.id,
                              });
                          }}
                          className="hidden cursor-pointer rounded p-0.5 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:block"
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    </div>

                    <EditableText
                      multiline
                      value={session.name}
                      onCommit={(v) =>
                        dispatch({
                          type: "updateSession",
                          clientId: client.id,
                          campaignId: campaign.id,
                          sessionId: session.id,
                          patch: { name: v },
                        })
                      }
                      className="mt-1 text-[11px] font-semibold leading-snug"
                    />

                    <div className="mt-auto flex items-center gap-1 pt-2">
                      <input
                        type="date"
                        title="The session's date — entering it schedules every series bound to this session"
                        value={session.date ?? ""}
                        onChange={(e) => setSessionDate(session, e.target.value)}
                        className={`min-w-0 flex-1 cursor-pointer rounded border px-1 py-0.5 text-center text-[10px] font-bold tabular-nums focus:outline-none ${
                          session.date
                            ? "border-transparent text-paper"
                            : "border-dashed border-white/15 text-mist/70"
                        }`}
                        style={
                          session.date
                            ? { backgroundColor: `${tone.color}22` }
                            : undefined
                        }
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="d"
                        data-tip="Day number: days after the campaign start"
                        value={
                          typeof session.offsetDays === "number" ? session.offsetDays : ""
                        }
                        onChange={(e) =>
                          dispatch({
                            type: "updateSession",
                            clientId: client.id,
                            campaignId: campaign.id,
                            sessionId: session.id,
                            patch: {
                              offsetDays:
                                e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                        className="num-plain w-10 shrink-0 rounded border border-white/10 bg-navy/60 px-1 py-0.5 text-center text-[10px] font-bold tabular-nums text-mist focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </li>
                );
              })}

              {/* ghost card — add a session */}
              <li>
                <button
                  onClick={() =>
                    dispatch({
                      type: "addSession",
                      clientId: client.id,
                      campaignId: campaign.id,
                    })
                  }
                  data-tip="Add a meeting to this campaign — you can drag it into place afterwards"
                  className="flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-white/12 text-mist/60 transition-colors hover:border-white/30 hover:text-paper"
                >
                  <Plus size={16} />
                  <span className="text-[11px] font-semibold">New session</span>
                </button>
              </li>
            </ol>
          ) : (
            /* List view — the order and the dates, one line each */
            <div>
              <div className="hidden grid-cols-[2rem_minmax(0,1fr)_5rem_9rem_4rem_6rem_2rem] items-center gap-3 border-b border-white/8 pb-1.5 text-[11px] font-medium text-mist lg:grid">
                <span>#</span>
                <span>Session</span>
                <span>Where</span>
                <span>Date</span>
                <span>Day</span>
                <span>Series</span>
                <span />
              </div>
              <ol className="flex flex-col">
                {campaign.sessions.map((session, i) => {
                  const state = sessionState(session);
                  const tone = SESSION_STATE[state];
                  const boundCount = campaign.series.filter(
                    (s) => s.sessionId === session.id
                  ).length;
                  const dragging = dragId === session.id;
                  const isOver = overIndex === i && dragId !== null && !dragging;

                  return (
                    <li
                      key={session.id}
                      draggable
                      {...dragProps(session.id, i)}
                      className={`group grid cursor-grab grid-cols-1 items-center gap-2 border-b border-white/6 py-2 last:border-b-0 active:cursor-grabbing lg:grid-cols-[2rem_minmax(0,1fr)_5rem_9rem_4rem_6rem_2rem] lg:gap-3 ${
                        state === "past" ? "opacity-60" : ""
                      } ${dragging ? "opacity-50" : ""} ${
                        isOver ? "ring-1 ring-[#ff7a55]" : ""
                      }`}
                    >
                      <span
                        data-tip={tone.tip}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-navy"
                        style={{ backgroundColor: tone.color }}
                      >
                        {i + 1}
                      </span>
                      <EditableText
                        value={session.name}
                        onCommit={(v) =>
                          dispatch({
                            type: "updateSession",
                            clientId: client.id,
                            campaignId: campaign.id,
                            sessionId: session.id,
                            patch: { name: v },
                          })
                        }
                        className="text-xs font-semibold"
                      />
                      <button
                        onClick={() =>
                          dispatch({
                            type: "updateSession",
                            clientId: client.id,
                            campaignId: campaign.id,
                            sessionId: session.id,
                            patch: {
                              mode:
                                session.mode === "virtual" ? "in-person" : "virtual",
                            },
                          })
                        }
                        data-tip="Click to switch between virtual and in person"
                        className="flex w-fit cursor-pointer items-center gap-1 text-[11px] text-mist hover:text-paper"
                      >
                        {session.mode === "virtual" ? (
                          <>
                            <Video size={11} /> online
                          </>
                        ) : (
                          <>
                            <MapPin size={11} /> live
                          </>
                        )}
                      </button>
                      <input
                        type="date"
                        title="The session's date — entering it schedules every series bound to this session"
                        value={session.date ?? ""}
                        onChange={(e) => setSessionDate(session, e.target.value)}
                        className={`cursor-pointer rounded border px-1.5 py-1 text-center text-[11px] font-bold tabular-nums focus:outline-none ${
                          session.date
                            ? "border-transparent text-paper"
                            : "border-dashed border-white/15 text-mist/70"
                        }`}
                        style={
                          session.date ? { backgroundColor: `${tone.color}22` } : undefined
                        }
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="—"
                        data-tip="Day number: days after the campaign start"
                        value={
                          typeof session.offsetDays === "number" ? session.offsetDays : ""
                        }
                        onChange={(e) =>
                          dispatch({
                            type: "updateSession",
                            clientId: client.id,
                            campaignId: campaign.id,
                            sessionId: session.id,
                            patch: {
                              offsetDays:
                                e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                        className="num-plain rounded border border-white/10 bg-navy/60 px-1 py-1 text-center text-[11px] font-bold tabular-nums text-mist focus:border-white/30 focus:outline-none"
                      />
                      <span className="text-[11px] text-mist">
                        {boundCount === 0 ? "—" : `${boundCount} series`}
                      </span>
                      <button
                        data-tip="Delete this session — series bound to it fall back to unbound"
                        onClick={async () => {
                          if (
                            await confirmDelete({
                              name: session.name,
                              detail: "Deletes this meeting from the campaign. Series bound to it lose their trigger and stop being scheduled until rebound.",
                            })
                          )
                            dispatch({
                              type: "removeSession",
                              clientId: client.id,
                              campaignId: campaign.id,
                              sessionId: session.id,
                            });
                        }}
                        className="cursor-pointer justify-self-end rounded p-1 text-mist opacity-0 transition-opacity hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button
                onClick={() =>
                  dispatch({
                    type: "addSession",
                    clientId: client.id,
                    campaignId: campaign.id,
                  })
                }
                data-tip="Add a meeting to this campaign — you can drag it into place afterwards"
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-white/12 py-2 text-[11px] font-semibold text-mist/60 transition-colors hover:border-white/30 hover:text-paper"
              >
                <Plus size={14} /> New session
              </button>
            </div>
          )
}
        </section>

        {/* Campaign series */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Layers size={17} className="text-mist" /> Campaign series
              <span className="text-sm font-medium text-mist">
                ({campaign.series.length})
              </span>
            </h2>
            <GhostButton onClick={() => setPickingModule((v) => !v)}>
              + Add series
            </GhostButton>
          </div>
          <p className="mb-4 text-xs text-mist">
            Click a series to see its lessons; drag it to change the order.
          </p>

          {pickingModule && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-white/10 p-3">
              {unloaded.length === 0 && (
                <p className="text-xs text-mist">
                  Every series from the library is already in this campaign.{" "}
                  <Link
                    href="/settings/campaigns"
                    className="font-semibold text-paper underline"
                  >
                    Create a new series in Settings → Campaigns
                  </Link>
                </p>
              )}
              {unloaded.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    dispatch({
                      type: "loadSeries",
                      clientId: client.id,
                      campaignId: campaign.id,
                      templateIds: [t.id],
                    });
                    setPickingModule(false);
                  }}
                  data-tip={`Add ${t.name} to this campaign — ${t.steps.length} lessons, usually triggered by the ${t.triggerLabel}`}
                  className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold text-paper"
                  style={{ backgroundColor: t.color }}
                >
                  + {t.code} · {t.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {campaign.series.map((loaded, i) => {
              const series = findTemplate(templates, loaded.templateId);
              if (!series) return null;
              const p = seriesProgress(campaign, loaded, series, today);
              const session = triggerSession(campaign, loaded);
              const schedule = computeSchedule(campaign, loaded, series, today);
              const isExpanded = expanded.has(loaded.templateId);
              const dragging = seriesDragId === loaded.templateId;
              const isOver =
                seriesOverIndex === i && seriesDragId !== null && !dragging;

              return (
                <div
                  key={loaded.templateId}
                  draggable
                  onDragStart={(e) => {
                    setSeriesDragId(loaded.templateId);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `series:${loaded.templateId}`);
                  }}
                  onDragEnd={endSeriesDrag}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (seriesOverIndex !== i) setSeriesOverIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const data = e.dataTransfer.getData("text/plain");
                    const moved = data.startsWith("series:")
                      ? data.slice(7)
                      : seriesDragId;
                    if (moved) {
                      dispatch({
                        type: "moveSeriesTo",
                        clientId: client.id,
                        campaignId: campaign.id,
                        templateId: moved,
                        toIndex: i,
                      });
                    }
                    endSeriesDrag();
                  }}
                  className={`card group cursor-grab transition-all active:cursor-grabbing ${
                    dragging
                      ? "rotate-1 scale-[1.02] opacity-70 shadow-2xl shadow-flame/20"
                      : ""
                  } ${isOver ? "ring-2 ring-[#ff7a55]" : ""}`}
                >
                  {/* header row — click to expand */}
                  <div
                    onClick={() => toggleExpanded(loaded.templateId)}
                    className="flex cursor-pointer items-center gap-4 p-4"
                  >
                    <span data-tip="Drag to change the series order">
                      <GripVertical
                        size={14}
                        className="shrink-0 text-mist/40 group-hover:text-mist"
                      />
                    </span>
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-md text-xs font-bold text-paper"
                      style={{ backgroundColor: series.color }}
                    >
                      {series.code}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {series.name}
                        <span className="ml-2 font-medium text-mist">· {series.focus}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-mist">
                        <span>Triggered by</span>
                        <select
                          title="The session whose date triggers this series — rebind to mix the order"
                          value={loaded.sessionId ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            dispatch({
                              type: "bindSeries",
                              clientId: client.id,
                              campaignId: campaign.id,
                              templateId: loaded.templateId,
                              sessionId: e.target.value || null,
                            })
                          }
                          className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1 text-xs font-semibold text-paper focus:border-white/30 focus:outline-none"
                        >
                          <option value="">— not bound —</option>
                          {campaign.sessions.map((s, si) => (
                            <option key={s.id} value={s.id}>
                              {si + 1}. {s.name}
                            </option>
                          ))}
                        </select>
                        <span>
                          {p.scheduled
                            ? p.next
                              ? `· next send ${fmtDate(p.next.date!)}`
                              : "· all sent"
                            : session
                              ? `· ${session.name} has no date yet`
                              : "· bind to a session to schedule"}
                        </span>
                      </div>
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

                    <button
                      data-tip="Remove this series from the campaign (the blueprint stays in Settings)"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (
                          await confirmDelete({
                            name: `${series.code} · ${series.name}`,
                            detail: "Removes the series and its scheduled sends from this campaign. The blueprint in Settings is untouched — it can be added back.",
                            verb: "Remove",
                          })
                        )
                          dispatch({
                            type: "unloadSeries",
                            clientId: client.id,
                            campaignId: campaign.id,
                            templateId: loaded.templateId,
                          });
                      }}
                      className="hidden shrink-0 cursor-pointer rounded p-1.5 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:block"
                    >
                      <Trash2 size={13} />
                    </button>

                    <span data-tip={isExpanded ? "Hide the lessons" : "Show the lessons in this series"}>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-mist transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </div>

                  {/* expanded: the meetup this series follows + its lessons */}
                  {isExpanded && (
                    <div className="border-t border-white/5 px-4 py-3">
                      <ol className="flex flex-col">
                        {session && (
                          <li
                            className="mb-1.5 flex items-center gap-3 rounded-md border px-2 py-2"
                            style={{
                              borderColor: `${series.color}55`,
                              backgroundColor: `${series.color}14`,
                            }}
                          >
                            <span
                              className="flex size-5 shrink-0 items-center justify-center rounded-full text-paper"
                              style={{ backgroundColor: series.color }}
                            >
                              {session.mode === "virtual" ? (
                                <Video size={11} />
                              ) : (
                                <MapPin size={11} />
                              )}
                            </span>
                            <span className="w-20 shrink-0 text-xs font-bold text-mist">
                              {session.mode === "virtual" ? "Online" : "Live"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                              {session.name}
                              <span className="ml-1.5 hidden font-medium text-mist lg:inline">
                                — the meetup that starts this series
                              </span>
                            </span>
                            <input
                              type="date"
                              value={session.date ?? ""}
                              title="Reschedule this session — every send below moves with it"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onChange={(e) => setSessionDate(session, e.target.value)}
                              className="shrink-0 cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1 text-[11px] font-semibold tabular-nums focus:border-white/30 focus:outline-none"
                            />
                          </li>
                        )}
                        {schedule.map((item, si) => (
                          <li
                            key={item.step.id}
                            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/4"
                          >
                            <span
                              className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-paper"
                              style={{ backgroundColor: series.color }}
                            >
                              {si + 1}
                            </span>
                            <span className="w-20 shrink-0 truncate text-xs font-bold text-mist">
                              {item.step.code}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">
                              {item.step.title}
                            </span>
                            {item.step.leader.teamMeeting && (
                              <Chip color="#ff7a55">team meeting</Chip>
                            )}
                            <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-mist">
                              {item.date
                                ? `${fmtWeekday(item.date)} ${fmtDateShort(item.date)}`
                                : "—"}
                            </span>
                            <span className="w-24 shrink-0 text-right">
                              <StatusChip status={item.status} />
                            </span>
                            <span
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <TestSendButton
                                compact
                                campaignId={campaign.id}
                                stepId={item.step.id}
                                variant="participant"
                                variantLabel={
                                  JSON.stringify(item.step.participant) ===
                                  JSON.stringify(item.step.leader)
                                    ? undefined
                                    : "Participant"
                                }
                              />
                            </span>
                          </li>
                        ))}
                        {schedule.length === 0 && (
                          <li className="px-2 py-2 text-xs text-mist">
                            No lessons in this series yet.
                          </li>
                        )}
                      </ol>
                      <div className="mt-2 border-t border-white/5 pt-2 text-right">
                        <Link
                          href={`/settings/campaigns/${series.campaignTemplateId}/series/${series.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-semibold text-mist transition-colors hover:text-paper"
                        >
                          Edit lessons & emails →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {campaign.series.length === 0 && (
              <button
                onClick={() => setPickingModule(true)}
                data-tip="A campaign needs at least one series before anything can be sent"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-white/10 py-6 text-sm font-semibold text-mist/60 transition-colors hover:border-white/25 hover:text-paper"
              >
                <Plus size={15} /> Add a series to this campaign
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Recalculate: one session moved, offer to carry the rest along.
          Fixed to the bottom because the date can be changed from either
          the session cards or the series overview. */}
      {shift && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-6">
          <div className="card pointer-events-auto flex max-w-2xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 shadow-2xl shadow-black/40">
            <p className="min-w-0 flex-1 text-xs">
              <span className="font-semibold">{shift.name}</span> moved{" "}
              {Math.abs(shift.days)} day{Math.abs(shift.days) === 1 ? "" : "s"}{" "}
              {shift.days > 0 ? "later" : "earlier"}. Move the {shift.count}{" "}
              session{shift.count === 1 ? "" : "s"} after it as well?
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                data-tip="Every later session, and every send that hangs off it, moves by the same number of days"
                data-tip-pos="top"
                onClick={() => {
                  dispatch({
                    type: "shiftSessionsAfter",
                    clientId: client.id,
                    campaignId: campaign.id,
                    sessionId: shift.sessionId,
                    days: shift.days,
                  });
                  setShift(null);
                }}
                className="brand-gradient cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
              >
                Move them too
              </button>
              <button
                onClick={() => setShift(null)}
                data-tip="Keep the later sessions on the dates they already have"
                data-tip-pos="top"
                className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
              >
                Leave them
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
