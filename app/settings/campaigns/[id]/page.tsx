"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Clock, Trash2, X, Zap } from "lucide-react";
import { Chip, GradientButton, GhostButton } from "@/components/ui";
import { EditableText, Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { useConfirm } from "@/components/confirm";
import { seriesOfCampaignTemplate } from "@/lib/store";
import type { SessionKey } from "@/lib/types";

function NewSeriesForm({
  campaignTemplateId,
  onClose,
}: {
  campaignTemplateId: string;
  onClose: () => void;
}) {
  const { dispatch } = useData();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [focus, setFocus] = useState("");
  const [trigger, setTrigger] = useState<SessionKey>("orientation");
  const [customTrigger, setCustomTrigger] = useState("");

  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">New series</h2>
        <button
          data-tip="Close without creating"
          onClick={onClose}
          className="cursor-pointer rounded-md p-1 text-mist hover:bg-white/5 hover:text-paper"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Post-Workshop" />
        <Field label="Code" value={code} onChange={setCode} placeholder="e.g. PWEA" />
        <Field label="Focus" value={focus} onChange={setFocus} placeholder="e.g. Leadership" />
        <label className="block">
          <span className="text-[11px] font-medium text-mist">
            Usually triggered by
          </span>
          <select
            title="The session whose date usually starts this series — pick one, or name your own"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as SessionKey)}
            className="mt-1 w-full rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-[13px] focus:border-white/30 focus:outline-none"
          >
            <option value="preplanning">Pre-Planning Session</option>
            <option value="orientation">Orientation Session</option>
            <option value="workshop">Workshop</option>
            <option value="coaching1">Coaching Session 1</option>
            <option value="coaching2">Coaching Session 2</option>
            <option value="launch">Launch Session</option>
            <option value="__custom">Something else…</option>
          </select>
          {trigger === "__custom" && (
            <input
              autoFocus
              value={customTrigger}
              onChange={(e) => setCustomTrigger(e.target.value)}
              placeholder="Name the session, e.g. Kick-off Call"
              data-tip="Your own session name — a campaign session carrying this exact name will trigger the series automatically; otherwise bind it by hand"
              className="mt-2 w-full rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-[13px] focus:border-white/30 focus:outline-none"
            />
          )}
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <GradientButton
          onClick={() => {
            if (!name.trim() || !code.trim()) return;
            if (trigger === "__custom" && !customTrigger.trim()) return;
            dispatch({
              type: "addSeries",
              campaignTemplateId,
              name: name.trim(),
              code: code.trim(),
              focus,
              trigger: trigger === "__custom" ? customTrigger.trim() : trigger,
            });
            onClose();
          }}
        >
          Create series
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}

export default function CampaignTemplateDetailPage() {
  const confirmDelete = useConfirm();
  const { id } = useParams<{ id: string }>();
  const { campaignTemplates, templates, clients, dispatch } = useData();
  const [showForm, setShowForm] = useState(false);

  const ct = campaignTemplates.find((t) => t.id === id);
  if (!ct) {
    return (
      <div className="card p-10 text-center text-sm text-mist">
        Campaign blueprint not found.{" "}
        <Link href="/settings/campaigns" className="font-semibold text-paper underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const series = seriesOfCampaignTemplate(templates, ct.id);
  const inUse = clients.reduce(
    (n, c) => n + c.campaigns.filter((x) => x.templateId === ct.id).length,
    0
  );

  return (
    <>
      <Link
        href="/settings/campaigns"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> All campaigns
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <EditableText
              value={ct.name}
              onCommit={(v) =>
                dispatch({ type: "updateCampaignTemplate", templateId: ct.id, patch: { name: v } })
              }
              className="text-xl font-bold"
            />
            <Chip color="#a3a4f0">{ct.code}</Chip>
          </div>
          <EditableText
            multiline
            value={ct.description}
            onCommit={(v) =>
              dispatch({
                type: "updateCampaignTemplate",
                templateId: ct.id,
                patch: { description: v },
              })
            }
            className="mt-1 max-w-3xl text-sm text-mist"
          />
        </div>
        <GradientButton onClick={() => setShowForm(true)}>+ New series</GradientButton>
      </div>

      <div className="card mb-6 flex flex-wrap items-center gap-x-8 gap-y-2 p-5 text-sm">
        <p>
          <span className="text-mist">Series:</span>{" "}
          <span className="font-semibold">{series.length}</span>
        </p>
        <p>
          <span className="text-mist">Lessons:</span>{" "}
          <span className="font-semibold">
            {series.reduce((n, s) => n + s.steps.length, 0)}
          </span>
        </p>
        <p>
          <span className="text-mist">Used by:</span>{" "}
          <span className="font-semibold">
            {inUse} client campaign{inUse === 1 ? "" : "s"}
          </span>
        </p>
        <p className="text-xs text-mist">
          Click a series to edit its lessons, emails and cadence.
        </p>
      </div>

      {showForm && (
        <NewSeriesForm campaignTemplateId={ct.id} onClose={() => setShowForm(false)} />
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {series.map((s, i) => {
          const meetings = s.steps.filter((x) => x.leader.teamMeeting).length;
          const cadence =
            s.steps.length === 0
              ? "no lessons yet"
              : s.steps[0].offsetDays < 7
                ? `+${s.steps[0].offsetDays}d, then weekly`
                : "weekly";
          return (
            <div
              key={s.id}
              className="card card-hover group relative"
              style={{
                backgroundImage: `linear-gradient(140deg, ${s.color}30 0%, ${s.color}0c 55%, transparent 100%)`,
                borderColor: `${s.color}55`,
              }}
            >
              <Link
                href={`/settings/campaigns/${ct.id}/series/${s.id}`}
                data-tip="Open the lessons and emails of this series"
                data-tip-pos="bottom"
                className="block p-6"
              >
                <div className="flex items-start justify-between pr-6">
                  <div
                    className="flex size-12 items-center justify-center rounded-md text-sm font-bold text-paper"
                    style={{ backgroundColor: s.color }}
                  >
                    {s.code}
                  </div>
                  <Chip color={s.color}>{s.steps.length} lessons</Chip>
                </div>
                <h2 className="mt-4 text-base font-bold">{s.name}</h2>
                <p className="mt-0.5 text-sm text-mist">{s.focus}</p>
                <div className="mt-4 flex flex-col gap-1.5 border-t border-white/5 pt-4 text-xs text-mist">
                  <p className="flex items-center gap-1.5">
                    <Zap size={12} style={{ color: s.color }} />
                    Usually triggered by {s.triggerLabel}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Clock size={12} /> Cadence: {cadence} · 08:00
                  </p>
                  {meetings > 0 && (
                    <p className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {meetings} team meeting{meetings > 1 ? "s" : ""} embedded
                    </p>
                  )}
                </div>
              </Link>
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-0.5">
                <button
                  data-tip="Move this series one place up"
                  disabled={i === 0}
                  onClick={() =>
                    dispatch({
                      type: "moveSeriesTemplate",
                      campaignTemplateId: ct.id,
                      templateId: s.id,
                      dir: -1,
                    })
                  }
                  className="cursor-pointer rounded p-1 text-mist/60 transition-colors hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-25"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  data-tip="Move this series one place down"
                  disabled={i === series.length - 1}
                  onClick={() =>
                    dispatch({
                      type: "moveSeriesTemplate",
                      campaignTemplateId: ct.id,
                      templateId: s.id,
                      dir: 1,
                    })
                  }
                  className="cursor-pointer rounded p-1 text-mist/60 transition-colors hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-25"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  data-tip="Delete this series and its lessons — it also disappears from client campaigns using it"
                  onClick={async () => {
                    if (
                      await confirmDelete({
                        name: `${s.code} · ${s.name}`,
                        detail: "Deletes the series and every lesson and email in it — it also disappears from client campaigns using it.",
                      })
                    ) {
                      dispatch({ type: "removeSeries", templateId: s.id });
                    }
                  }}
                  className="cursor-pointer rounded p-1 text-mist/60 transition-colors hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}

        <button
          data-tip="Create a new series in this blueprint"
          onClick={() => setShowForm(true)}
          className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-white/10 p-6 text-center transition-colors hover:border-white/25"
        >
          <p className="text-sm font-semibold text-mist/70">+ Add a series</p>
          <p className="max-w-52 text-xs text-mist/50">
            This campaign can hold as many series as it needs.
          </p>
        </button>
      </div>
    </>
  );
}
