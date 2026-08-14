"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  GripVertical,
  Layers,
  Mail,
  MapPin,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { Chip, ProgressBar, GhostButton, StatusChip } from "@/components/ui";
import { EditableText } from "@/components/editable";
import { useData } from "@/lib/state";
import { team } from "@/lib/data";
import {
  computeSchedule,
  findCampaign,
  findStaff,
  findTemplate,
  seriesProgress,
  campaignCompletion,
  campaignStatus,
  triggerSession,
  fmtDate,
  fmtDateShort,
  fmtWeekday,
} from "@/lib/store";
import type { CampaignStatus } from "@/lib/types";

const STATUS_STYLE: Record<CampaignStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: "rgba(74,222,128,0.14)", fg: "#4ade80", label: "Active" },
  upcoming: { bg: "rgba(235,50,15,0.16)", fg: "#ff7a55", label: "Upcoming" },
  paused: { bg: "rgba(250,204,21,0.15)", fg: "#facc15", label: "Paused" },
  closed: { bg: "rgba(174,176,178,0.14)", fg: "#aeb0b2", label: "Closed" },
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
  tone,
  tip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  tone?: { bg: string; fg: string };
  tip?: string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-mist">
        {label}
      </span>
      <select
        title={tip}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-none"
        style={
          tone
            ? { backgroundColor: tone.bg, color: tone.fg, borderColor: "transparent" }
            : {
                backgroundColor: "rgba(20,20,60,0.6)",
                color: "#eeeeef",
                borderColor: "rgba(255,255,255,0.10)",
              }
        }
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
  const { clients, templates, dispatch } = useData();
  const [pickingModule, setPickingModule] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [seriesDragId, setSeriesDragId] = useState<string | null>(null);
  const [seriesOverIndex, setSeriesOverIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  const staffOptions = [
    { value: "", label: "— unassigned —" },
    ...team.map((t) => ({ value: t.id, label: t.name })),
  ];

  const endDrag = () => {
    setDragId(null);
    setOverIndex(null);
  };

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
          <InlineSelect
            label="Status"
            tip="Automatic follows the schedule; pick a value to override it by hand"
            value={campaign.statusOverride ?? ""}
            tone={STATUS_STYLE[status]}
            onChange={(v) =>
              dispatch({
                type: "updateCampaign",
                clientId: client.id,
                campaignId: campaign.id,
                patch: { statusOverride: (v || undefined) as CampaignStatus | undefined },
              })
            }
            options={[
              { value: "", label: `Automatic (${STATUS_STYLE[status].label})` },
              { value: "upcoming", label: "Upcoming" },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "closed", label: "Closed" },
            ]}
          />
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
      <section className="card mb-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-mist">
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
                className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-1.5 py-1 text-[11px] font-bold tabular-nums text-paper focus:border-white/30 focus:outline-none"
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
                className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-1.5 py-1 text-[11px] font-bold tabular-nums text-paper focus:border-white/30 focus:outline-none"
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

      {/* Phoenix team & champions */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-1 text-base font-bold">Phoenix team for this campaign</h2>
          <p className="mb-4 text-xs text-mist">
            By default the client&rsquo;s own Phoenix team applies — override any
            role for this campaign. The Coach is the one the emails are sent from.
          </p>
          <div className="flex flex-col gap-3">
            {(
              [
                ["Phoenix Leader", "phoenixLeaderId"],
                ["Phoenix Coach", "phoenixCoachId"],
                ["Project Manager", "projectManagerId"],
              ] as const
            ).map(([label, key]) => {
              const clientDefault = findStaff(team, client[key]);
              return (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="brand-gradient rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">
                    {label}
                  </span>
                  <select
                    title={`${label} for this campaign — leave on the client default or override`}
                    value={campaign[key] ?? ""}
                    onChange={(e) =>
                      dispatch({
                        type: "updateCampaign",
                        clientId: client.id,
                        campaignId: campaign.id,
                        patch: { [key]: e.target.value || undefined },
                      })
                    }
                    className="min-w-0 flex-1 cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
                  >
                    <option value="">
                      {clientDefault
                        ? `Client default (${clientDefault.name})`
                        : "Client default (unassigned)"}
                    </option>
                    {team.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-bold">Client Transformational Champion</h2>
            <button
              data-tip="Add another champion for this campaign"
              onClick={() =>
                dispatch({
                  type: "addChampion",
                  clientId: client.id,
                  campaignId: campaign.id,
                  name: "New champion",
                  email: "",
                })
              }
              className="cursor-pointer rounded-lg border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
            >
              <Plus size={14} />
            </button>
          </div>
          <p className="mb-4 text-xs text-mist">
            The client-side leader(s) of this campaign — campaign-specific, and
            there can be more than one.
          </p>
          <div className="flex flex-col gap-2">
            {campaign.champions.map((champ) => (
              <div
                key={champ.id}
                className="group flex items-center gap-3 rounded-xl border border-white/8 px-3 py-2"
              >
                <span className="brand-gradient flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                  {champ.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("") || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <EditableText
                    value={champ.name}
                    placeholder="Champion name…"
                    onCommit={(v) =>
                      dispatch({
                        type: "updateChampion",
                        clientId: client.id,
                        campaignId: campaign.id,
                        championId: champ.id,
                        patch: { name: v },
                      })
                    }
                    className="text-sm font-semibold"
                  />
                  <EditableText
                    value={champ.email}
                    placeholder="email@client.org"
                    onCommit={(v) =>
                      dispatch({
                        type: "updateChampion",
                        clientId: client.id,
                        campaignId: campaign.id,
                        championId: champ.id,
                        patch: { email: v },
                      })
                    }
                    className="text-xs text-mist"
                  />
                </div>
                {champ.email && (
                  <a
                    data-tip="Write an email to this champion"
                    href={`mailto:${champ.email}`}
                    className="shrink-0 text-mist hover:text-paper"
                  >
                    <Mail size={13} />
                  </a>
                )}
                <button
                  data-tip="Remove this champion"
                  onClick={() =>
                    dispatch({
                      type: "removeChampion",
                      clientId: client.id,
                      campaignId: campaign.id,
                      championId: champ.id,
                    })
                  }
                  className="hidden shrink-0 cursor-pointer rounded p-1 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:block"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {campaign.champions.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-mist">
                No champion yet — add the client leader for this campaign.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-6">
        {/* Sessions — square, draggable cards */}
        <section className="card p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <CalendarDays size={17} className="text-mist" /> Sessions
              <span className="text-sm font-medium text-mist">
                ({campaign.sessions.length})
              </span>
            </h2>
          </div>
          <p className="mb-5 text-xs text-mist">
            The live and online meetings in this campaign. Drag a card to reorder —
            the numbering follows. A session&rsquo;s date triggers the series bound to it.
          </p>

          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {campaign.sessions.map((session, i) => {
              const date = session.date ? new Date(`${session.date}T00:00:00`) : null;
              const past = date !== null && date < today;
              const boundCount = campaign.series.filter(
                (s) => s.sessionId === session.id
              ).length;
              const dragging = dragId === session.id;
              const isOver = overIndex === i && dragId !== null && !dragging;

              return (
                <li
                  key={session.id}
                  draggable
                  onDragStart={(e) => {
                    setDragId(session.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", session.id);
                  }}
                  onDragEnd={endDrag}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overIndex !== i) setOverIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const moved = e.dataTransfer.getData("text/plain") || dragId;
                    if (moved) {
                      dispatch({
                        type: "moveSessionTo",
                        clientId: client.id,
                        campaignId: campaign.id,
                        sessionId: moved,
                        toIndex: i,
                      });
                    }
                    endDrag();
                  }}
                  className={`card group relative flex min-h-52 cursor-grab flex-col p-3.5 transition-all active:cursor-grabbing ${
                    dragging
                      ? "rotate-3 scale-105 opacity-70 shadow-2xl shadow-flame/20"
                      : ""
                  } ${isOver ? "ring-2 ring-[#ff7a55]" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-mist">
                      Session {i + 1}
                    </p>
                    <div className="flex items-center gap-0.5">
                      <span data-tip="Drag the card to another position to reorder">
                        <GripVertical
                          size={12}
                          className="text-mist/40 group-hover:text-mist"
                        />
                      </span>
                      <button
                        data-tip="Delete this session — series bound to it fall back to unbound"
                        onClick={() =>
                          dispatch({
                            type: "removeSession",
                            clientId: client.id,
                            campaignId: campaign.id,
                            sessionId: session.id,
                          })
                        }
                        className="hidden cursor-pointer rounded p-0.5 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:block"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
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
                    className="mt-1 text-xs font-semibold leading-snug"
                  />

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
                    className="mt-1.5 flex w-fit cursor-pointer items-center gap-1 text-[10px] text-mist hover:text-paper"
                  >
                    {session.mode === "virtual" ? (
                      <>
                        <Video size={10} /> virtual
                      </>
                    ) : (
                      <>
                        <MapPin size={10} /> in person
                      </>
                    )}
                  </button>

                  <div className="mt-auto pt-2">
                    <input
                      type="date"
                      title="The session's date — entering it schedules every series bound to this session"
                      value={session.date ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "updateSession",
                          clientId: client.id,
                          campaignId: campaign.id,
                          sessionId: session.id,
                          patch: { date: e.target.value || null },
                        })
                      }
                      className={`w-full cursor-pointer rounded-lg border px-1 py-1 text-center text-[11px] font-bold tabular-nums focus:outline-none ${
                        date
                          ? past
                            ? "border-transparent bg-white/8 text-paper"
                            : "brand-gradient-soft border-transparent text-paper"
                          : "border-dashed border-white/15 text-mist/70"
                      }`}
                    />
                    <p className="mt-1.5 truncate text-[10px] text-mist/70">
                      {boundCount === 0 ? "no series" : `triggers ${boundCount} series`}
                    </p>
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
                className="flex min-h-52 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border border-dashed border-white/12 text-mist/60 transition-colors hover:border-white/30 hover:text-paper"
              >
                <Plus size={18} />
                <span className="text-xs font-semibold">New session</span>
              </button>
            </li>
          </ol>
        </section>

        {/* Campaign series */}
        <section className="card p-6">
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
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-3">
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
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-paper transition-transform hover:scale-105"
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
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-paper"
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
                          className="cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-2 py-1 text-xs font-semibold text-paper focus:border-white/30 focus:outline-none"
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
                      onClick={(e) => {
                        e.stopPropagation();
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

                  {/* expanded: the lessons in this series */}
                  {isExpanded && (
                    <div className="border-t border-white/5 px-4 py-3">
                      <ol className="flex flex-col">
                        {schedule.map((item, si) => (
                          <li
                            key={item.step.id}
                            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/4"
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
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-6 text-sm font-semibold text-mist/60 transition-colors hover:border-white/25 hover:text-paper"
              >
                <Plus size={15} /> Add a series to this campaign
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
