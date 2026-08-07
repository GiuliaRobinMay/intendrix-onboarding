"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { GradientButton, GhostButton } from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";

/** Create a campaign for a client. A client can have as many as they need. */
export function NewCampaignForm({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const { templates, dispatch } = useData();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [withStandardSessions, setWithStandard] = useState(true);
  const [picked, setPicked] = useState<string[]>(templates.map((t) => t.id));

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

      <div className="grid gap-4 md:grid-cols-2">
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

      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-mist">
          Series to load
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {templates.map((t) => {
            const on = picked.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-transform hover:scale-105"
                style={
                  on
                    ? { backgroundColor: t.color, color: "#eeeeef" }
                    : {
                        backgroundColor: "rgba(174,176,178,0.10)",
                        color: "#aeb0b2",
                      }
                }
              >
                {on ? "✓ " : "+ "}
                {t.code}
              </button>
            );
          })}
          {templates.length === 0 && (
            <p className="text-xs text-mist">No series in the library yet.</p>
          )}
        </div>
        <p className="mt-2 text-[11px] text-mist/70">
          Loaded series bind automatically to the matching session; you can rebind
          or reorder them afterwards.
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        <GradientButton
          onClick={() => {
            if (!name.trim()) return;
            dispatch({
              type: "addCampaign",
              clientId,
              name: name.trim(),
              code: code.trim() || "TLE",
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
