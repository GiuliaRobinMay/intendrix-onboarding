"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, CopyPlus, Layers, Users, X } from "lucide-react";
import { Chip, GradientButton, GhostButton } from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { seriesOfCampaignTemplate } from "@/lib/store";

function NewCampaignTemplateForm({ onClose }: { onClose: () => void }) {
  const { dispatch } = useData();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="card mb-6 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">New campaign blueprint</h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1 text-mist hover:bg-white/5 hover:text-paper"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="e.g. TLE for Supervisors & Managers"
        />
        <Field label="Code" value={code} onChange={setCode} placeholder="e.g. TLE-SM" />
        <Field
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Who it's for and how long it runs"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <GradientButton
          onClick={() => {
            if (!name.trim()) return;
            dispatch({
              type: "addCampaignTemplate",
              name: name.trim(),
              code: code.trim() || "TLE",
              description,
            });
            onClose();
          }}
        >
          Create blueprint
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}

export default function CampaignTemplatesPage() {
  const { campaignTemplates, templates, clients, dispatch } = useData();
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-2xl text-sm text-mist">
          Campaign blueprints are the reusable designs behind every client
          campaign. Open one to manage the series it contains and the lessons in
          each series.
        </p>
        <GradientButton onClick={() => setShowForm(true)}>+ New campaign</GradientButton>
      </div>

      {showForm && <NewCampaignTemplateForm onClose={() => setShowForm(false)} />}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {campaignTemplates.map((ct) => {
          const series = seriesOfCampaignTemplate(templates, ct.id);
          const lessons = series.reduce((n, s) => n + s.steps.length, 0);
          const inUse = clients.reduce(
            (n, c) => n + c.campaigns.filter((x) => x.templateId === ct.id).length,
            0
          );
          return (
            <div key={ct.id} className="card card-hover group relative">
              <button
                data-tip="Duplicate this campaign with all its series and lessons"
                onClick={() => dispatch({ type: "duplicateCampaignTemplate", templateId: ct.id })}
                className="absolute right-3 top-3 z-10 hidden cursor-pointer rounded-lg border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper group-hover:block"
              >
                <CopyPlus size={14} />
              </button>
              <Link href={`/settings/campaigns/${ct.id}`} className="block p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="brand-gradient flex size-12 items-center justify-center rounded-xl text-sm font-bold text-paper">
                  {ct.code}
                </div>
                <Chip color="#a3a4f0">
                  {series.length} series
                </Chip>
              </div>
              <h2 className="mt-4 text-base font-bold">{ct.name}</h2>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-mist">
                {ct.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/5 pt-4 text-xs text-mist">
                <span className="flex items-center gap-1.5">
                  <Layers size={12} /> {series.length} series
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen size={12} /> {lessons} lessons
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={12} /> {inUse} client campaign{inUse === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {series.map((s) => (
                  <Chip key={s.id} color={s.color}>
                    {s.code}
                  </Chip>
                ))}
              </div>
              </Link>
            </div>
          );
        })}

        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-white/10 p-6 text-center transition-colors hover:border-white/25"
        >
          <p className="text-sm font-semibold text-mist/70">+ New campaign blueprint</p>
          <p className="max-w-56 text-xs text-mist/50">
            A campaign can hold one or more series — TLE-E, TLE for Supervisors &
            Managers, anything you design next.
          </p>
        </button>
      </div>
    </>
  );
}
