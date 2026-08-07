"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Layers,
  MapPin,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { PageHeader, Chip, ProgressBar, GhostButton } from "@/components/ui";
import { EditableText } from "@/components/editable";
import { useData } from "@/lib/state";
import {
  findCampaign,
  findTemplate,
  seriesProgress,
  campaignCompletion,
  triggerSession,
  fmtDate,
} from "@/lib/store";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { clients, templates, dispatch } = useData();
  const [pickingModule, setPickingModule] = useState(false);
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
  const unloaded = templates.filter(
    (t) => !campaign.series.some((s) => s.templateId === t.id)
  );

  return (
    <>
      <Link
        href="/campaigns"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> All campaigns
      </Link>

      <PageHeader
        title={campaign.name}
        subtitle={`${client.name} · ${completion.sent} of ${completion.total} lessons sent`}
        action={
          <div className="flex items-center gap-3">
            <Chip color="#a3a4f0">{campaign.code}</Chip>
            <Link
              href={`/clients/${client.id}`}
              className="text-xs font-semibold text-mist transition-colors hover:text-paper"
            >
              Client page →
            </Link>
          </div>
        }
      />

      <div className="mb-6">
        <ProgressBar pct={completion.pct} />
      </div>

      <div className="flex flex-col gap-6">
        {/* Sessions — variable number */}
        <section className="card p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <CalendarDays size={17} className="text-mist" /> Sessions
              <span className="text-sm font-medium text-mist">
                ({campaign.sessions.length})
              </span>
            </h2>
            <GhostButton
              onClick={() =>
                dispatch({
                  type: "addSession",
                  clientId: client.id,
                  campaignId: campaign.id,
                })
              }
            >
              + Add session
            </GhostButton>
          </div>
          <p className="mb-5 text-xs text-mist">
            The live and online meetings in this campaign — add as many as you
            need, or none at all. A session&rsquo;s date triggers the series bound
            to it. Timezone: {campaign.timezone}.
          </p>

          {campaign.sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-mist">
              No sessions in this campaign yet — add one to start scheduling, or
              leave it empty for a campaign that runs on lessons alone.
            </div>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {campaign.sessions.map((session, i) => {
                const date = session.date ? new Date(`${session.date}T00:00:00`) : null;
                const past = date !== null && date < today;
                const boundCount = campaign.series.filter(
                  (s) => s.sessionId === session.id
                ).length;
                return (
                  <li key={session.id} className="card group p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-mist">
                        Session {i + 1}
                      </p>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          disabled={i === 0}
                          onClick={() =>
                            dispatch({
                              type: "moveSession",
                              clientId: client.id,
                              campaignId: campaign.id,
                              sessionId: session.id,
                              dir: -1,
                            })
                          }
                          className="cursor-pointer rounded p-1 text-mist hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-30"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          disabled={i === campaign.sessions.length - 1}
                          onClick={() =>
                            dispatch({
                              type: "moveSession",
                              clientId: client.id,
                              campaignId: campaign.id,
                              sessionId: session.id,
                              dir: 1,
                            })
                          }
                          className="cursor-pointer rounded p-1 text-mist hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-30"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() =>
                            dispatch({
                              type: "removeSession",
                              clientId: client.id,
                              campaignId: campaign.id,
                              sessionId: session.id,
                            })
                          }
                          className="cursor-pointer rounded p-1 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

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
                      className="mt-1 text-sm font-semibold"
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
                      className="mt-2 flex cursor-pointer items-center gap-1 text-[10px] text-mist hover:text-paper"
                    >
                      {session.mode === "virtual" ? (
                        <>
                          <Video size={11} /> virtual
                        </>
                      ) : (
                        <>
                          <MapPin size={11} /> in person
                        </>
                      )}
                    </button>

                    <input
                      type="date"
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
                      className={`mt-3 w-full cursor-pointer rounded-lg border px-2 py-1.5 text-center text-xs font-bold tabular-nums focus:outline-none ${
                        date
                          ? past
                            ? "border-transparent bg-white/8 text-paper"
                            : "brand-gradient-soft border-transparent text-paper"
                          : "border-dashed border-white/15 text-mist/70"
                      }`}
                    />

                    <p className="mt-2 text-[10px] text-mist/70">
                      {boundCount === 0
                        ? "No series triggered by this session"
                        : `Triggers ${boundCount} series`}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Loaded series */}
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Layers size={17} className="text-mist" /> Loaded series
              <span className="text-sm font-medium text-mist">
                ({campaign.series.length})
              </span>
            </h2>
            {unloaded.length > 0 && (
              <GhostButton onClick={() => setPickingModule((v) => !v)}>
                + Load module
              </GhostButton>
            )}
          </div>

          {pickingModule && unloaded.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-white/10 p-3">
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
              return (
                <div key={loaded.templateId} className="card group p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-paper"
                      style={{ backgroundColor: series.color }}
                    >
                      {series.code}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/settings/campaigns/${series.campaignTemplateId}/series/${series.id}`}
                        className="text-sm font-bold hover:underline"
                      >
                        {series.name}
                        <span className="ml-2 font-medium text-mist">
                          · {series.focus}
                        </span>
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-mist">
                        <span>Triggered by</span>
                        <select
                          value={loaded.sessionId ?? ""}
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
                              ? "· session has no date yet"
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

                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        disabled={i === 0}
                        onClick={() =>
                          dispatch({
                            type: "moveSeries",
                            clientId: client.id,
                            campaignId: campaign.id,
                            templateId: loaded.templateId,
                            dir: -1,
                          })
                        }
                        className="cursor-pointer rounded p-1.5 text-mist hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-30"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        disabled={i === campaign.series.length - 1}
                        onClick={() =>
                          dispatch({
                            type: "moveSeries",
                            clientId: client.id,
                            campaignId: campaign.id,
                            templateId: loaded.templateId,
                            dir: 1,
                          })
                        }
                        className="cursor-pointer rounded p-1.5 text-mist hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-30"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        onClick={() =>
                          dispatch({
                            type: "unloadSeries",
                            clientId: client.id,
                            campaignId: campaign.id,
                            templateId: loaded.templateId,
                          })
                        }
                        className="cursor-pointer rounded p-1.5 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {campaign.series.length === 0 && (
              <button
                onClick={() => setPickingModule(true)}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-6 text-sm font-semibold text-mist/60 transition-colors hover:border-white/25 hover:text-paper"
              >
                <Plus size={15} /> Load a series into this campaign
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
