"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Clock,
  Crown,
  ExternalLink,
  Mail,
  Paperclip,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { Chip, GhostButton } from "@/components/ui";
import { EditableText } from "@/components/editable";
import { TestSendButton } from "@/components/test-send";
import { useData, type Action } from "@/lib/state";
import { MERGE_FIELDS } from "@/lib/merge";
import { useConfirm } from "@/components/confirm";
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
    <div className={`rounded-md px-2.5 py-1.5 ${lesson.url ? "bg-white/5" : "bg-[#eb320f]/15"}`}>
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
  testCampaignId,
  stepId,
  variantLabel,
}: {
  label: string;
  content: StepContent;
  leader?: boolean;
  onPatch: (patch: Partial<StepContent>) => void;
  /** the campaign a test goes out as; absent = no campaign uses this series */
  testCampaignId?: string;
  stepId: string;
  variantLabel?: string;
}) {
  return (
    <div className="rounded-md bg-white/3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-mist">
          {leader ? <Crown size={12} className="text-[#ff7a55]" /> : <Users size={12} />}
          {label}
        </p>
        {testCampaignId ? (
          <TestSendButton
            compact
            campaignId={testCampaignId}
            stepId={stepId}
            variant={leader ? "leader" : "participant"}
            variantLabel={variantLabel}
          />
        ) : (
          <span
            data-tip="No client campaign uses this series yet, so there is no sender to test as. Add the series to a campaign first."
            className="cursor-help text-[11px] text-mist/50"
          >
            no test
          </span>
        )}
      </div>
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
      {/* the merge fields, so nobody has to remember the spelling */}
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-mist/70">
        <span>Write</span>
        {MERGE_FIELDS.map((f) => (
          <code
            key={f.token}
            data-tip={`Becomes ${f.means}`}
            className="cursor-help rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-mist"
          >
            {f.token}
          </code>
        ))}
        <span>anywhere in the subject or the text.</span>
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        <LessonLinkEditor content={content} onPatch={onPatch} />
        {content.attachment ? (
          <div className="rounded-md bg-white/5 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              <Paperclip size={12} className="shrink-0 text-mist" />
              <EditableText
                value={content.attachment.label}
                placeholder="File name, e.g. Leaders Guide.pdf"
                onCommit={(v) =>
                  onPatch({ attachment: { ...content.attachment!, label: v } })
                }
                className="text-xs font-medium"
              />
              <button
                data-tip="Remove the attachment from this email"
                onClick={() => onPatch({ attachment: null })}
                className="ml-auto shrink-0 cursor-pointer rounded p-0.5 text-mist/60 hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
              >
                <Trash2 size={11} />
              </button>
            </div>
            <EditableText
              value={content.attachment.url ?? ""}
              placeholder="Direct https link to the file…"
              onCommit={(v) =>
                onPatch({ attachment: { ...content.attachment!, url: v.trim() || null } })
              }
              className={`mt-0.5 text-[11px] ${content.attachment.url ? "text-mist/70" : "text-[#ff7a55]"}`}
            />
            {content.attachment.url && !content.attachment.url.startsWith("https://") && (
              <p className="mt-1 text-[10px] font-semibold text-[#ff7a55]">
                The link must start with https:// and point straight at the
                file — a share page won&rsquo;t attach.
              </p>
            )}
          </div>
        ) : (
          <button
            data-tip="Attach one file to this email — paste a direct link, the file itself travels with the message"
            onClick={() =>
              onPatch({ attachment: { label: "", url: null } })
            }
            className="flex w-fit cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-mist/60 transition-colors hover:text-paper"
          >
            <Paperclip size={11} /> Add an attachment
          </button>
        )}
        {content.extras?.map((x) =>
          x.url ? (
            <a
              key={x.label}
              href={x.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-paper"
            >
              <ExternalLink size={12} /> {x.label}
            </a>
          ) : null
        )}
      </div>
      {content.teamMeeting && (
        <p className="mt-3 rounded-md border border-white/10 bg-navy/60 p-2.5 text-xs leading-relaxed">
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
  testCampaignId,
}: {
  step: SeriesStep;
  index: number;
  count: number;
  series: SeriesTemplate;
  dispatch: (a: Action) => void;
  testCampaignId?: string;
}) {
  const confirmDelete = useConfirm();
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
            className="w-12 rounded-md border border-white/10 bg-navy/60 px-1.5 py-1 text-center text-xs font-bold tabular-nums focus:border-white/30 focus:outline-none"
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
            className="rounded-md border border-white/10 bg-navy/60 px-1.5 py-1 text-xs font-bold tabular-nums focus:border-white/30 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            data-tip="Move this lesson earlier"
            disabled={index === 0}
            onClick={() => dispatch({ type: "moveStep", templateId: series.id, stepId: step.id, dir: -1 })}
            className="cursor-pointer rounded-md p-1.5 text-mist hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-30"
          >
            <ArrowUp size={14} />
          </button>
          <button
            data-tip="Move this lesson later"
            disabled={index === count - 1}
            onClick={() => dispatch({ type: "moveStep", templateId: series.id, stepId: step.id, dir: 1 })}
            className="cursor-pointer rounded-md p-1.5 text-mist hover:bg-white/10 hover:text-paper disabled:cursor-default disabled:opacity-30"
          >
            <ArrowDown size={14} />
          </button>
          <button
            data-tip="Delete this lesson from the series"
            onClick={async () => {
              if (
                await confirmDelete({
                  name: `${step.code} · ${step.title}`,
                  detail: "Deletes this lesson and both of its email versions from the series, for every campaign that uses it.",
                })
              )
                dispatch({ type: "removeStep", templateId: series.id, stepId: step.id });
            }}
            className="cursor-pointer rounded-md p-1.5 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
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
            testCampaignId={testCampaignId}
            stepId={step.id}
          />
        ) : (
          <>
            <VariantEditor
              label="Participant series"
              content={step.participant}
              onPatch={patchContent("participant")}
              testCampaignId={testCampaignId}
              stepId={step.id}
              variantLabel="Participant"
            />
            <VariantEditor
              label="Leader series"
              content={step.leader}
              leader
              onPatch={patchContent("leader")}
              testCampaignId={testCampaignId}
              stepId={step.id}
              variantLabel="Leader"
            />
          </>
        )}
      </div>
    </li>
  );
}

export default function SeriesEditorPage() {
  const { id, seriesId } = useParams<{ id: string; seriesId: string }>();
  const { campaignTemplates, templates, clients, dispatch } = useData();
  // A test needs a real campaign behind it — that is where the sender, the
  // client name and the personalisation come from. Offer the campaigns
  // that actually use this series.
  const usingThis = clients.flatMap((c) =>
    c.campaigns
      .filter((cp) => cp.series.some((ls) => ls.templateId === seriesId))
      .map((cp) => ({ id: cp.id, label: `${c.shortName} · ${cp.code}` }))
  );
  const [testCampaignId, setTestCampaignId] = useState(usingThis[0]?.id);

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
        <div className="flex flex-wrap items-center gap-3">
          {usingThis.length > 0 && (
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-mist">Test as</span>
              <select
                data-tip="Which campaign a test send uses — it decides the sender, the client name and what the merge fields become"
                value={testCampaignId ?? ""}
                onChange={(e) => setTestCampaignId(e.target.value)}
                className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1 text-xs font-semibold text-paper focus:border-white/30 focus:outline-none"
              >
                {usingThis.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <GhostButton
            tip="Add a lesson at the end of this series"
            onClick={() => dispatch({ type: "addStep", templateId: series.id })}
          >
            + Add lesson
          </GhostButton>
        </div>
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
            testCampaignId={testCampaignId}
          />
        ))}
      </ol>

      <button
        data-tip="Add a new lesson at the end of this series"
        onClick={() => dispatch({ type: "addStep", templateId: series.id })}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-white/10 py-5 text-sm font-semibold text-mist/60 transition-colors hover:border-white/25 hover:text-paper"
      >
        <Plus size={15} /> Add a lesson to this series
      </button>
    </>
  );
}
