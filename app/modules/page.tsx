"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock, X, Zap } from "lucide-react";
import { PageHeader, Chip, GradientButton, GhostButton } from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";
import type { SessionKey } from "@/lib/types";

function NewSeriesForm({ onClose }: { onClose: () => void }) {
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
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Post-Workshop v2" />
        <Field label="Code" value={code} onChange={setCode} placeholder="e.g. PWSM" />
        <Field label="Focus" value={focus} onChange={setFocus} placeholder="e.g. Middle management" />
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
            Triggered by
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
            dispatch({ type: "addSeries", name: name.trim(), code: code.trim(), focus, trigger });
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

export default function ModulesPage() {
  const { templates } = useData();
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <PageHeader
        title="Modules"
        subtitle="Your reusable series library. Load a module into a client's program, then adapt the copy where needed."
        action={
          <GradientButton onClick={() => setShowForm(true)}>+ New series</GradientButton>
        }
      />

      {showForm && <NewSeriesForm onClose={() => setShowForm(false)} />}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((series) => {
          const meetings = series.steps.filter((s) => s.leader.teamMeeting).length;
          const cadence =
            series.steps.length === 0
              ? "no lessons yet"
              : series.steps[0].offsetDays < 7
                ? `+${series.steps[0].offsetDays}d, then weekly`
                : "weekly";
          return (
            <Link
              key={series.id}
              href={`/modules/${series.id}`}
              className="card card-hover block p-6"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex size-12 items-center justify-center rounded-xl text-sm font-bold text-paper"
                  style={{ backgroundColor: series.color }}
                >
                  {series.code}
                </div>
                <Chip color={series.color}>{series.steps.length} lessons</Chip>
              </div>
              <h2 className="mt-4 text-base font-bold">{series.name}</h2>
              <p className="mt-0.5 text-sm text-mist">{series.focus}</p>
              <div className="mt-4 flex flex-col gap-1.5 border-t border-white/5 pt-4 text-xs text-mist">
                <p className="flex items-center gap-1.5">
                  <Zap size={12} style={{ color: series.color }} />
                  Triggered by {series.triggerLabel}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock size={12} />
                  Cadence: {cadence} · 08:00
                </p>
                {meetings > 0 && (
                  <p className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    {meetings} team meeting{meetings > 1 ? "s" : ""} embedded
                  </p>
                )}
              </div>
            </Link>
          );
        })}

        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-white/10 p-6 text-center transition-colors hover:border-white/25"
        >
          <p className="text-sm font-semibold text-mist/70">+ Create a new series</p>
          <p className="max-w-52 text-xs text-mist/50">
            Fully flexible: add series, add lessons, reorder — nothing is locked to two variants.
          </p>
        </button>
      </div>
    </>
  );
}
