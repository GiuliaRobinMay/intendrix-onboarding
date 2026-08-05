import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Crown,
  ExternalLink,
  Mail,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { PageHeader, Chip, GhostButton, GradientButton } from "@/components/ui";
import { getSeriesTemplate } from "@/lib/store";
import type { SeriesStep, StepContent } from "@/lib/types";

function LinkRow({ link }: { link: { label: string; url: string | null } }) {
  if (!link.url) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#eb320f]/15 px-2.5 py-1 text-xs font-semibold text-[#ff7a55]">
        <TriangleAlert size={12} /> {link.label} — link missing
      </span>
    );
  }
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-mist transition-colors hover:bg-white/10 hover:text-paper"
    >
      <ExternalLink size={12} /> {link.label}
    </a>
  );
}

function VariantBlock({
  label,
  content,
  leader,
}: {
  label: string;
  content: StepContent;
  leader?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/3 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mist">
        {leader ? <Crown size={12} className="text-[#ff7a55]" /> : <Users size={12} />}
        {label}
      </p>
      <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold">
        <Mail size={14} className="mt-0.5 shrink-0 text-mist" />
        {content.emailSubject}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-mist">{content.emailBody}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {content.lesson && <LinkRow link={content.lesson} />}
        {content.extras?.map((x) => <LinkRow key={x.label} link={x} />)}
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

function StepCard({
  step,
  index,
  color,
}: {
  step: SeriesStep;
  index: number;
  color: string;
}) {
  const sameContent =
    JSON.stringify(step.participant) === JSON.stringify(step.leader);
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-paper"
          style={{ backgroundColor: color }}
        >
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {step.code} · {step.title}
          </p>
        </div>
        <Chip color={color}>
          <Clock size={11} />
          {index === 0
            ? `+${step.offsetDays} day${step.offsetDays > 1 ? "s" : ""} after trigger`
            : `+${step.offsetDays} day${step.offsetDays > 1 ? "s" : ""}`}{" "}
          · {step.sendTime}
        </Chip>
      </div>

      <div className={`mt-4 grid gap-3 ${sameContent ? "" : "lg:grid-cols-2"}`}>
        {sameContent ? (
          <VariantBlock label="Participant + Leader (identical)" content={step.participant} />
        ) : (
          <>
            <VariantBlock label="Participant series" content={step.participant} />
            <VariantBlock label="Leader series" content={step.leader} leader />
          </>
        )}
      </div>
    </li>
  );
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = getSeriesTemplate(id);
  if (!series) notFound();

  return (
    <>
      <Link
        href="/modules"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> Module library
      </Link>

      <PageHeader
        title={`${series.code} · ${series.name}`}
        subtitle={`Focus: ${series.focus}`}
        action={
          <div className="flex items-center gap-3">
            <GhostButton>Edit series</GhostButton>
            <GradientButton>Load into a client</GradientButton>
          </div>
        }
      />

      <div className="card mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 p-5 text-sm">
        <p className="flex items-center gap-2">
          <Zap size={15} style={{ color: series.color }} />
          <span className="text-mist">Trigger:</span>
          <span className="font-semibold">date of {series.triggerLabel}</span>
        </p>
        <p className="flex items-center gap-2">
          <Mail size={15} className="text-mist" />
          <span className="text-mist">Sends:</span>
          <span className="font-semibold">{series.steps.length} lessons, two variants in tandem</span>
        </p>
        <p className="text-xs text-mist">
          Both variants always go out on the identical schedule — only the content differs.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {series.steps.map((step, i) => (
          <StepCard key={step.id} step={step} index={i} color={series.color} />
        ))}
      </ol>
    </>
  );
}
