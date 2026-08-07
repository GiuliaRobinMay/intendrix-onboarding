"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { GradientButton, GhostButton, Chip } from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { seriesOfCampaignTemplate } from "@/lib/store";

/** Create a campaign for a client, from a campaign blueprint.
 *  A client can have as many campaigns as they need. */
export function NewCampaignForm({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const { campaignTemplates, templates, dispatch } = useData();
  const [templateId, setTemplateId] = useState(campaignTemplates[0]?.id ?? "");
  const [name, setName] = useState(campaignTemplates[0]?.name ?? "");
  const [code, setCode] = useState(campaignTemplates[0]?.code ?? "");
  const [withStandardSessions, setWithStandard] = useState(true);
  const [picked, setPicked] = useState<string[]>(
    campaignTemplates[0]
      ? seriesOfCampaignTemplate(templates, campaignTemplates[0].id).map((s) => s.id)
      : []
  );

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const ct = campaignTemplates.find((t) => t.id === id);
    if (ct) {
      setName(ct.name);
      setCode(ct.code);
      setPicked(seriesOfCampaignTemplate(templates, ct.id).map((s) => s.id));
    } else {
      setPicked([]);
    }
  };

  const available = templateId ? seriesOfCampaignTemplate(templates, templateId) : [];
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="card mb-6 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">New campaign</h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1 text-mist hover:bg-white/5 hover:text-paper"
        >
          <X size={16} />
        </button>
      </div>

      {/* blueprint picker */}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-mist">
        Start from a campaign
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {campaignTemplates.map((ct) => {
          const on = ct.id === templateId;
          return (
            <button
              key={ct.id}
              onClick={() => chooseTemplate(ct.id)}
              className={`cursor-pointer rounded-xl px-3.5 py-2 text-left text-xs font-bold transition-transform hover:scale-[1.02] ${
                on ? "brand-gradient text-paper" : "bg-white/6 text-mist"
              }`}
            >
              {ct.code}
              <span className="ml-2 font-medium opacity-80">{ct.name}</span>
            </button>
          );
        })}
        <button
          onClick={() => {
            setTemplateId("");
            setPicked([]);
          }}
          className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-bold transition-transform hover:scale-[1.02] ${
            templateId === "" ? "brand-gradient text-paper" : "bg-white/6 text-mist"
          }`}
        >
          Blank campaign
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Campaign name"
          value={name}
          onChange={setName}
          placeholder="e.g. TLE for Executives 2027"
        />
        <Field label="Code" value={code} onChange={setCode} placeholder="e.g. TLE-E" />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={withStandardSessions}
          onChange={(e) => setWithStandard(e.target.checked)}
          className="size-4 cursor-pointer accent-[#eb320f]"
        />
        <span>
          Start with the five standard sessions
          <span className="text-mist">
            {" "}
            — otherwise start empty and add as many sessions as this campaign needs
          </span>
        </span>
      </label>

      {available.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-mist">
            Series to load
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {available.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-transform hover:scale-105"
                  style={
                    on
                      ? { backgroundColor: t.color, color: "#eeeeef" }
                      : { backgroundColor: "rgba(174,176,178,0.10)", color: "#aeb0b2" }
                  }
                >
                  {on ? "✓ " : "+ "}
                  {t.code}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-mist/70">
            Loaded series bind automatically to the matching session; you can rebind
            or reorder them afterwards.
          </p>
        </div>
      )}

      {templateId === "" && (
        <p className="mt-4 flex items-center gap-2 text-xs text-mist">
          <Chip color="#ff7a55">Blank</Chip>
          No series loaded — you can load them into the campaign later.
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <GradientButton
          onClick={() => {
            if (!name.trim()) return;
            dispatch({
              type: "addCampaign",
              clientId,
              name: name.trim(),
              code: code.trim() || "TLE",
              fromTemplateId: templateId || undefined,
              withStandardSessions,
              templateIds: picked,
            });
            onClose();
          }}
        >
          Create campaign
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}
