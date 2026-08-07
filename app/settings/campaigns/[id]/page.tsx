"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, Trash2, X, Zap } from "lucide-react";
import { Chip, GradientButton, GhostButton } from "@/components/ui";
import { EditableText, Field } from "@/components/editable";
import { useData } from "@/lib/state";
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

  return (
    <div className="card mb-6 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">New series</h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1 text-mist hover:bg-white/5 hover:text-paper"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Post-Workshop" />
        <Field label="Code" value={code} onChange={setCode} placeholder="e.g. PWEA" />
        <Field label="Focus" value={focus} onChange={setFocus} placeholder="e.g. Leadership" />
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
            Usually triggered by
          </span>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as SessionKey)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
          >
            <option value="orientation">Orientation Session</option>
            <option value="workshop">Workshop</option>
            <option value="coaching1">Coaching Session 1</option>
            <option value="coaching2">Coaching Session 2</option>
            <option value="launch">Launch Session</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <GradientButton
          onClick={() => {
            if (!name.trim() || !code.trim()) return;
            dispatch({
              type: "addSeries",
              campaignTemplateId,
              name: name.trim(),
              code: code.trim(),
              focus,
              trigger,
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
        {series.map((s) => {
          const meetings = s.steps.filter((x) => x.leader.teamMeeting).length;
          const cadence =
            s.steps.length === 0
              ? "no lessons yet"
              : s.steps[0].offsetDays < 7
                ? `+${s.steps[0].offsetDays}d, then weekly`
                : "weekly";
          return (
            <div key={s.id} className="card card-hover group relative">
              <Link href={`/settings/campaigns/${ct.id}/series/${s.id}`} className="block p-6">
                <div className="flex items-start justify-between pr-6">
                  <div
                    className="flex size-12 items-center justify-center rounded-xl text-sm font-bold text-paper"
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
              <button
                title="Delete this series"
                onClick={() => {
                  if (confirm(`Delete the ${s.code} series and its lessons?`)) {
                    dispatch({ type: "removeSeries", templateId: s.id });
                  }
                }}
                className="absolute right-3 top-3 hidden cursor-pointer rounded-lg p-1.5 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:block"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-white/10 p-6 text-center transition-colors hover:border-white/25"
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
