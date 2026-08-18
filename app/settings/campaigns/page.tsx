"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, ChevronRight, CopyPlus, Layers, Trash2, Users, X } from "lucide-react";
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
    <div className="card mb-6 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">New campaign blueprint</h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-md p-1 text-mist hover:bg-white/5 hover:text-paper"
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

      {/* List */}
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2.6fr)_minmax(0,1.6fr)_5.5rem_5.5rem_7rem_4.5rem_1rem] items-center gap-4 border-b border-white/8 px-5 py-3 text-[11px] font-medium text-mist lg:grid">
          <span>Campaign</span>
          <span>Series</span>
          <span>Lessons</span>
          <span>Used by</span>
          <span />
          <span />
          <span />
        </div>

        <ul className="divide-y divide-white/5">
          {campaignTemplates.map((ct) => {
            const series = seriesOfCampaignTemplate(templates, ct.id);
            const lessons = series.reduce((n, s) => n + s.steps.length, 0);
            const inUse = clients.reduce(
              (n, c) => n + c.campaigns.filter((x) => x.templateId === ct.id).length,
              0
            );
            return (
              <li key={ct.id} className="group relative">
                <Link
                  href={`/settings/campaigns/${ct.id}`}
                  className="grid grid-cols-1 items-center gap-3 px-5 py-4 transition-colors hover:bg-white/4 lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1.6fr)_5.5rem_5.5rem_7rem_4.5rem_1rem] lg:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-16 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/6 text-xs font-bold text-paper">
                      {ct.code}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{ct.name}</span>
                      <span className="block truncate text-xs text-mist">
                        {ct.description}
                      </span>
                    </span>
                  </div>

                  <span className="flex flex-wrap gap-1">
                    {series.map((s) => (
                      <Chip key={s.id} color={s.color}>
                        {s.code}
                      </Chip>
                    ))}
                    {series.length === 0 && (
                      <span className="text-[11px] italic text-mist/50">
                        No series yet
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-1.5 text-xs text-mist">
                    <BookOpen size={12} />
                    <span className="font-bold tabular-nums text-paper">{lessons}</span>
                  </span>

                  <span className="flex items-center gap-1.5 text-xs text-mist">
                    <Users size={12} />
                    <span className="font-bold tabular-nums text-paper">{inUse}</span>
                  </span>

                  <span className="flex items-center gap-1.5 text-xs text-mist">
                    <Layers size={12} />
                    <span className="font-bold tabular-nums text-paper">
                      {series.length}
                    </span>
                    series
                  </span>

                  <span />
                  <ChevronRight size={16} className="hidden text-mist lg:block" />
                </Link>

                <div className="absolute right-12 top-1/2 hidden -translate-y-1/2 items-center gap-1 group-hover:flex">
                  <button
                    data-tip="Duplicate this campaign with all its series and lessons"
                    onClick={() =>
                      dispatch({ type: "duplicateCampaignTemplate", templateId: ct.id })
                    }
                    className="cursor-pointer rounded-md border border-white/10 bg-navy/80 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
                  >
                    <CopyPlus size={13} />
                  </button>
                  <button
                    data-tip="Delete this campaign blueprint and its series"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete the ${ct.code} blueprint and its ${series.length} series?`
                        )
                      ) {
                        dispatch({ type: "removeCampaignTemplate", templateId: ct.id });
                      }
                    }}
                    className="cursor-pointer rounded-md border border-white/10 bg-navy/80 p-1.5 text-mist transition-colors hover:border-[#eb320f]/40 hover:text-[#ff7a55]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 text-xs text-mist">
        {campaignTemplates.length} campaign blueprint
        {campaignTemplates.length === 1 ? "" : "s"} in the library.
      </p>
    </>
  );
}
