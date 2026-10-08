"use client";

// Everything a client needs, asked once.
//
// The old form asked for three things and let the other seven wait on
// a page nobody reopens: the state the client is in, which is what puts
// their campaigns in their own morning instead of Eastern; the space
// and invitation links, without which the onboarding emails have
// nowhere to send anyone; and who at Phoenix is responsible.
//
// None of it is compulsory. All of it is asked.

import { useState } from "react";
import { Field } from "@/components/editable";
import { Wizard, type WizardStep } from "@/components/wizard";
import { useData } from "@/lib/state";
import { US_STATES, stateByCode } from "@/lib/us-states";

/** The short name a client is known by in lists, guessed from the long
 *  one: the first couple of words, which is what people actually say. */
function shortNameFor(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.slice(0, 2).join(" ");
}

export function NewClientWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (clientId: string) => void;
}) {
  const { staff, dispatch } = useData();
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [spaceUrl, setSpaceUrl] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [leader, setLeader] = useState("");
  const [coach, setCoach] = useState("");
  const [manager, setManager] = useState("");

  const zone = stateByCode(stateCode)?.tz;

  const person = (
    label: string,
    tip: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <label className="block">
      <span className="text-[11px] font-medium text-mist">{label}</span>
      <select
        data-tip={tip}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
      >
        <option value="">Nobody yet</option>
        {staff.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.role ? ` — ${p.role}` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const steps: WizardStep[] = [
    {
      title: "The organization",
      hint: "The state matters more than it looks: it is what puts this client's campaigns in their own morning instead of Eastern time.",
      ready: name.trim().length > 0,
      blocker: "A name, at least",
      body: (
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Organization name"
            value={name}
            onChange={(v) => {
              setName(v);
              // follows along until it is edited by hand
              if (!shortName || shortName === shortNameFor(name)) setShortName(shortNameFor(v));
            }}
            placeholder="e.g. CareSouth Carolina"
          />
          <Field
            label="Short name"
            value={shortName}
            onChange={setShortName}
            placeholder="How they appear in lists"
          />
          <Field label="Sector" value={sector} onChange={setSector} placeholder="e.g. Community healthcare" />
          <Field label="City" value={city} onChange={setCity} placeholder="e.g. Hartsville" />
          <label className="block">
            <span className="text-[11px] font-medium text-mist">State</span>
            <select
              data-tip="Sets the timezone every campaign for this client starts in"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              className="mt-1 w-full cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              <option value="">Not set — campaigns start in Eastern</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            {zone && (
              <span className="mt-1 block text-[11px] text-mist">
                Campaigns will send on {zone.split("/").pop()?.replace(/_/g, " ")} time
              </span>
            )}
          </label>
        </div>
      ),
      warning: stateCode
        ? undefined
        : "Without a state, campaigns for this client send on Eastern time whether or not that is their morning.",
    },
    {
      title: "Their space in the community",
      hint: "Both links come from Mighty Networks. The space link is where their team lands; the invitation link is the one the welcome email sends them to join.",
      body: (
        <div className="grid gap-4">
          <Field
            label="Space link"
            value={spaceUrl}
            onChange={setSpaceUrl}
            placeholder="https://intendrix.ai/…"
          />
          <Field
            label="Invitation link"
            value={inviteUrl}
            onChange={setInviteUrl}
            placeholder="The plan invitation link for this client"
          />
        </div>
      ),
      warning:
        spaceUrl.trim() && inviteUrl.trim()
          ? undefined
          : "The invitation email has nowhere to send anyone until the invitation link is here. You can add it later on the client page.",
    },
    {
      title: "Who at Phoenix",
      hint: "Campaigns for this client start with these three, and each campaign can be given its own. Who the emails come from is chosen per campaign, separately — it is not read from this card.",
      body: (
        <div className="grid gap-4 md:grid-cols-3">
          {person("Phoenix Leader", "Owns the relationship", leader, setLeader)}
          {person("Phoenix Coach", "Runs the sessions", coach, setCoach)}
          {person("Project Manager", "Keeps it on schedule", manager, setManager)}
        </div>
      ),
      warning:
        leader || coach || manager
          ? undefined
          : "Nobody at Phoenix is responsible for this client yet. It will show as unassigned everywhere until somebody is.",
    },
  ];

  return (
    <Wizard
      title="New client organization"
      steps={steps}
      finishLabel="Create client"
      onClose={onClose}
      onFinish={() => {
        if (!name.trim()) return;
        const id = crypto.randomUUID();
        dispatch({
          type: "addClient",
          id,
          name: name.trim(),
          location: [city.trim(), stateByCode(stateCode)?.name].filter(Boolean).join(", "),
          sector: sector.trim(),
        });
        dispatch({
          type: "updateClient",
          clientId: id,
          patch: {
            shortName: shortName.trim() || shortNameFor(name),
            ...(city.trim() ? { city: city.trim() } : {}),
            ...(stateCode ? { state: stateCode } : {}),
            ...(spaceUrl.trim() ? { spaceUrl: spaceUrl.trim() } : {}),
            ...(inviteUrl.trim() ? { inviteUrl: inviteUrl.trim() } : {}),
            ...(leader ? { phoenixLeaderId: leader } : {}),
            ...(coach ? { phoenixCoachId: coach } : {}),
            ...(manager ? { projectManagerId: manager } : {}),
          },
        });
        onCreated?.(id);
        onClose();
      }}
    />
  );
}
