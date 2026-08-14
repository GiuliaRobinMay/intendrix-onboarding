"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Clock,
  Crown,
  ExternalLink,
  Mail,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { Chip, GhostButton } from "@/components/ui";
import { EditableText } from "@/components/editable";
import { useData, type Action } from "@/lib/state";
import type { SeriesStep, SeriesTemplate, StepContent } from "@/lib/types";

function LessonLinkEditor({
  content,
  onPatch,
}: {
  content: StepContent;
  onPatch: (patch: Partial<StepContent>) => void;
}) {
  const lesson = content.lesson;
  if (!lesson) return null;
  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${lesson.url ? "bg-white/5" : "bg-[#eb320f]/15"}`}>
      <div className="flex items-center gap-1.5">
        {lesson.url ? (
          <a data-tip="Open the lesson in Intendrix" href={lesson.url} target="_blank" rel="noreferrer" className="shrink-0">
            <ExternalLink size={12} className="text-mist hover:text-paper" />
          </a>
        ) : (
          <span data-tip="This lesson has no link yet — paste the intendrix.ai URL below">
            <TriangleAlert size={12} className="shrink-0 text-[#ff7a55]" />
          </span>
        )}
        <EditableText
          value={lesson.label}
          onCommit={(v) => onPatch({ lesson: { ...lesson, label: v } })}
          className="text-xs font-medium"
        />
      </div>
      <EditableText
        value={lesson.url ?? ""}
        placeholder="Paste the intendrix.ai lesson URL…"
        onCommit={(v) => onPatch({ lesson: { ...lesson, url: v.trim() || null } })}
        className={`mt-0.5 text-[11px] ${lesson.url ? "text-mist/70" : "text-[#ff7a55]"}`}
      />
    </div>
  );
}

function VariantEditor({
  label,
  content,
  leader,
  onPatch,
}: {
  label: string;
  content: StepContent;
  leader?: boolean;
  onPatch: (patch: Partial<StepContent>) => void;
}) {
  return (
    <div className="rounded-xl bg-white/3 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mist">
        {leader ? <Crown size={12} className="text-[#ff7a55]" /> : <Users size={12} />}
        {label}
      </p>
      <div className="mt-2 flex items-start gap-1.5">
        <Mail size={14} className="mt-1 shrink-0 text-mist" />
        <EditableText
          value={content.emailSubject}
          onCommit={(v) => onPatch({ emailSubject: v })}
          className="text-sm font-semibold"
        />
      </div>
      <div className="mt-1.5">
        <EditableText
          multiline
          value={content.emailBody}
          onCommit={(v) => onPatch({ emailBody: v })}
          className="text-xs leading-relaxed text-mist"
        />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <LessonLinkEditor content={content} onPatch={onPatch} />
        {content.extras?.map((x) =>
          x.url ? (
            <a
              key={x.label}
              href={x.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-paper"
            >
              <ExternalLink size={12} /> {x.label}
            </a>
          ) : null
        )}
      </div>
      {content.teamMeeting && (
        <p className="mt-3 rounded-lg border border-white/10 bg-navy/60 p-2.5 text-xs leading-relaxed">
          <span className="font-bold text-[#ff7a55]">TEAM MEETING · </span>
          <span className="text-mist">{content.teamMeeting}</span>
        </p>
      )}
      {content.note && (
        <p className="mt-2 text-[11px] italic text-mist/70">Note: {content.note}</p>
      )}
    </div>
  );
}

function StepEditor({
  step,
  index,
  count,
  series,
  dispatch,
}: {
  step: SeriesStep;
  index: number;
  count: number;
  series: SeriesTemplate;
  dispatch: (a: Action) => void;
}) {
  const sameContent = JSON.stringify(step.participant) === JSON.stringify(step.leader);
  const patchContent =
    (variant: "participant" | "leader" | "both") => (patch: Partial<StepContent>) => {
      if (variant === "both") {
        dispatch({ type: "updateStepContent", templateId: series.id, stepId: step.id, variant: "participant", patch });
        dispatch({ type: "updateStepContent", templateId: series.id, stepId: step.id, variant: "leader", patch });
      } else {
        dispatch({ type: "updateStepContent", templateId: series.id, stepId: step.id, variant, patch });
      }
    };

  return (
    <li className="card group p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-paper"
          style={{ backgroundColor: series.color }}
        >
          {index + 1}
        </div>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 text-sm font-bold text-mist">
            <EditableText
              value={step.code}
              onCommit={(v) =>
                dispatch({ type: "updateStepMeta", templateId: series.id, stepId: step.id, patch: { code: v } })
              }
              className="w-24 text-sm font-bold"
            />
          </span>
          <EditableText
            value={step.title}
            onCommit={(v) =>
              dispatch({ type: "updateStepMeta", templateId: series.id, stepId: step.id, patch: { title: v } })
            }
            className="text-sm font-bold"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-mist">
          <Clock size={12} style={{ color: series.color }} />
          <span>+</span>
          <input
            type="number"
            min={0}
            title="Days to wait after the previous lesson (for the first lesson: after the trigger session)"
            value={step.offsetDays}
            onChange={(e) =>
              dispatch({
                type: "updateStepMeta",
                templateId: series.id,
                stepId: step.id,
                patch: { offsetDays: Math.max(0, Number(e.target.value) || 0) },
              })
            }
            className="w-12 rounded-lg border border-white/10 bg-navy/60 px-1.5 py-1 text-center text-xs font-bold tabular-nums focus:border-white/30 focus:outline-none"
          />
          <span>{index === 0 ? "days after trigger ·" : "days ·"}</span>
          <input
            type="time"
            title="Local time of day the email goes out"
            value={step.sendTime}
            onChange={(e) =>
              dispatch({
                type: "updateStepMeta",
                templateId: series.id,
                stepId: step.id,
                patch: { sendTime: e.target.value || "08:00" },
              })
            }
            className="rounded-lg border border-white/10 bg-navy/60 px-1.5 py-1 text-xs font-bold tabular-nums focus:border-white/30 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            data-tip="Move this lesson earlier"
            disabled={index === 0}
            onClick={() => dispatch({ type: "moveStep", templateId: series.id, stepId: step.id, dir: -1 })}
            className="cursor-pointer rounded-lg p-1.5 text-mist hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-30"
          >
            <ArrowUp size={14} />
          </button>
          <button
            data-tip="Move this lesson later"
            disabled={index === count - 1}
            onClick={() => dispatch({ type: "moveStep", templateId: series.id, stepId: step.id, dir: 1 })}
            className="cursor-pointer rounded-lg p-1.5 text-mist hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-30"
          >
            <ArrowDown size={14} />
          </button>
          <button
            data-tip="Delete this lesson from the series"
            onClick={() => dispatch({ type: "removeStep", templateId: series.id, stepId: step.id })}
            className="cursor-pointer rounded-lg p-1.5 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${sameContent ? "" : "lg:grid-cols-2"}`}>
        {sameContent ? (
          <VariantEditor
            label="Participant + Leader (identical)"
            content={step.participant}
            onPatch={patchContent("both")}
          />
        ) : (
          <>
            <VariantEditor
              label="Participant series"
              content={step.participant}
              onPatch={patchContent("participant")}
            />
            <VariantEditor
              label="Leader series"
              content={step.leader}
              leader
              onPatch={patchContent("leader")}
            />
          </>
        )}
      </div>
    </li>
  );
}

export default function SeriesEditorPage() {
  const { id, seriesId } = useParams<{ id: string; seriesId: string }>();
  const { campaignTemplates, templates, dispatch } = useData();

  const ct = campaignTemplates.find((t) => t.id === id);
  const series = templates.find((t) => t.id === seriesId);

  if (!ct || !series) {
    return (
      <div className="card p-10 text-center text-sm text-mist">
        Series not found.{" "}
        <Link href="/settings/campaigns" className="font-semibold text-paper underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        href={`/settings/campaigns/${ct.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> {ct.name}
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {series.code} · {series.name}
          </h2>
          <p className="mt-1 text-sm text-mist">
            Focus: {series.focus} — click any text to edit it.
          </p>
        </div>
        <GhostButton onClick={() => dispatch({ type: "addStep", templateId: series.id })}>
          + Add lesson
        </GhostButton>
      </div>

      <div className="card mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 p-5 text-sm">
        <p className="flex items-center gap-2">
          <Zap size={15} style={{ color: series.color }} />
          <span className="text-mist">Usually triggered by:</span>
          <span className="font-semibold">{series.triggerLabel}</span>
        </p>
        <p className="flex items-center gap-2">
          <Mail size={15} className="text-mist" />
          <span className="text-mist">Sends:</span>
          <span className="font-semibold">
            {series.steps.length} lessons, two variants in tandem
          </span>
        </p>
        <p className="text-xs text-mist">
          Each client campaign binds this series to one of its own sessions.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {series.steps.map((step, i) => (
          <StepEditor
            key={step.id}
            step={step}
            index={i}
            count={series.steps.length}
            series={series}
            dispatch={dispatch}
          />
        ))}
      </ol>

      <button
        onClick={() => dispatch({ type: "addStep", templateId: series.id })}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-white/10 py-5 text-sm font-semibold text-mist/60 transition-colors hover:border-white/25 hover:text-paper"
      >
        <Plus size={15} /> Add a lesson to this series
      </button>
    </>
  );
}
