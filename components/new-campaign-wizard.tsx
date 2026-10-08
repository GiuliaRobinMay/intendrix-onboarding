"use client";

// A campaign, with nothing left implied.
//
// The form this replaces created a campaign from a blueprint and said
// one line about everything else: "the Phoenix team is inherited from
// the client — override it afterwards if needed". Two of the three
// things that have gone wrong in this app started there. A campaign
// with no explicit sender sent mail under a name nobody chose, and a
// campaign on a client with no state sent at eight in the morning
// Eastern to people three timezones away.
//
// So the same questions are asked here instead, in order, before
// anything exists. Each one can still be answered with "nobody" or
// "leave it" — but it is answered, by a person, on purpose.

import { useState } from "react";
import { Chip } from "@/components/ui";
import { Field } from "@/components/editable";
import { Wizard, type WizardStep } from "@/components/wizard";
import { useData } from "@/lib/state";
import { seriesOfCampaignTemplate } from "@/lib/store";
import { stateByCode } from "@/lib/us-states";
import { TIMEZONES } from "@/lib/timezones";

export function NewCampaignWizard({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated?: (campaignId: string) => void;
}) {
  const { campaignTemplates, templates, clients, staff, dispatch } = useData();
  const client = clients.find((c) => c.id === clientId);
  const clientZone = stateByCode(client?.state)?.tz;

  const first = campaignTemplates[0];
  const [templateId, setTemplateId] = useState(first?.id ?? "");
  const [name, setName] = useState(first?.name ?? "");
  const [code, setCode] = useState(first?.code ?? "");
  const [withStandardSessions, setWithStandard] = useState(true);
  const [picked, setPicked] = useState<string[]>(
    first ? seriesOfCampaignTemplate(templates, first.id).map((s) => s.id) : []
  );
  const [timezone, setTimezone] = useState(clientZone ?? "America/New_York");
  const [leader, setLeader] = useState(client?.phoenixLeaderId ?? "");
  const [coach, setCoach] = useState(client?.phoenixCoachId ?? "");
  const [manager, setManager] = useState(client?.projectManagerId ?? "");
  const [senderSide, setSenderSide] = useState<"phoenix" | "client">("phoenix");
  const [senderId, setSenderId] = useState("");
  const [champion, setChampion] = useState("");

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

  const picker = (
    label: string,
    tip: string,
    value: string,
    onChange: (v: string) => void,
    options: Array<{ id: string; name: string; sub?: string | null }>,
    empty: string
  ) => (
    <label className="block">
      <span className="text-[11px] font-medium text-mist">{label}</span>
      <select
        data-tip={tip}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.sub ? ` — ${o.sub}` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const staffOptions = staff.map((p) => ({ id: p.id, name: p.name, sub: p.role }));
  const memberOptions = (client?.members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    sub: m.title,
  }));

  const steps: WizardStep[] = [
    {
      title: "Which programme",
      hint: "Start from a blueprint and its series come with it, or start blank and build it by hand.",
      ready: name.trim().length > 0,
      blocker: "A name, at least",
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            {campaignTemplates.map((ct) => (
              <button
                key={ct.id}
                data-tip={`Start from ${ct.name} — its series and sessions come with it`}
                onClick={() => chooseTemplate(ct.id)}
                className={`cursor-pointer rounded-md px-3.5 py-2 text-left text-xs font-bold ${
                  ct.id === templateId ? "brand-gradient-soft" : "bg-white/6 text-mist"
                }`}
              >
                {ct.code}
                <span className="ml-2 font-medium opacity-80">{ct.name}</span>
              </button>
            ))}
            <button
              data-tip="Start with nothing — add the sessions and series by hand afterwards"
              onClick={() => {
                setTemplateId("");
                setPicked([]);
              }}
              className={`cursor-pointer rounded-md px-3.5 py-2 text-xs font-bold ${
                templateId === "" ? "brand-gradient-soft" : "bg-white/6 text-mist"
              }`}
            >
              Blank campaign
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field
              label="Campaign name"
              value={name}
              onChange={setName}
              placeholder="e.g. TLE for Executives 2027"
            />
            <Field label="Code" value={code} onChange={setCode} placeholder="e.g. TLE-E" />
          </div>
        </>
      ),
    },
    {
      title: "Sessions and series",
      hint: "The sessions are the meetups. Each series of lesson emails hangs off one of them, and dating that session is what puts its emails on the calendar.",
      body: (
        <>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              data-tip="Orientation, Workshop, two Coaching Sessions and a Launch Session, ready to be dated"
              checked={withStandardSessions}
              onChange={(e) => setWithStandard(e.target.checked)}
              className="mt-0.5 size-4 cursor-pointer accent-[#eb320f]"
            />
            <span>
              Start with the five standard sessions
              <span className="text-mist">
                {" "}
                — otherwise start empty and add as many as this campaign needs
              </span>
            </span>
          </label>

          {available.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-medium text-mist">Series to load</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {available.map((t) => {
                  const on = picked.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      data-tip={`${t.name} — ${t.steps.length} lessons, usually triggered by the ${t.triggerLabel}. Click to include or leave out.`}
                      onClick={() => toggle(t.id)}
                      className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold"
                      style={
                        on
                          ? { backgroundColor: t.color, color: "#eeeeef" }
                          : {
                              backgroundColor:
                                "color-mix(in srgb, var(--color-mist) 12%, transparent)",
                              color: "var(--color-mist)",
                            }
                      }
                    >
                      {on ? "✓ " : "+ "}
                      {t.code}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {templateId === "" && (
            <p className="mt-4 flex items-center gap-2 text-xs text-mist">
              <Chip color="#ff7a55">Blank</Chip>
              No series loaded — you can load them into the campaign later.
            </p>
          )}
        </>
      ),
      warning:
        picked.length === 0 && templateId !== ""
          ? "No series selected, so this campaign has no lesson emails in it yet."
          : undefined,
    },
    {
      title: "What time they go out",
      hint: "Every lesson leaves at its own hour in this zone — the same moment for everybody, whatever time it is where you are reading this.",
      body: (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-mist">Timezone</span>
            <select
              data-tip="The client's own timezone — send times are read in this zone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>
          <p className="self-end text-[11px] leading-relaxed text-mist">
            {clientZone
              ? `${client?.shortName} is in ${clientZone.split("/").pop()?.replace(/_/g, " ")}, from the state on their client page.`
              : `${client?.shortName ?? "This client"} has no state set, so this started on Eastern. Set the state on their client page and it will be right by itself next time.`}
          </p>
        </div>
      ),
    },
    {
      title: "Who runs it, and who it comes from",
      hint: "Two different questions. The team is who is responsible; the sender is the name and address on the emails. One is never read from the other.",
      body: (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {picker("Phoenix Leader", "Owns the relationship", leader, setLeader, staffOptions, "Nobody")}
            {picker("Phoenix Coach", "Runs the sessions", coach, setCoach, staffOptions, "Nobody")}
            {picker("Project Manager", "Keeps it on schedule", manager, setManager, staffOptions, "Nobody")}
          </div>

          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="text-[11px] font-medium text-mist">Emails sent from</p>
            <div className="mt-2 flex gap-1 rounded-lg border border-white/10 bg-navy/60 p-1">
              {(["phoenix", "client"] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => {
                    setSenderSide(side);
                    setSenderId("");
                  }}
                  className={`flex-1 cursor-pointer rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                    senderSide === side
                      ? "bg-white/12 text-paper"
                      : "text-mist hover:bg-white/6 hover:text-paper"
                  }`}
                >
                  {side === "phoenix" ? "Phoenix team" : (client?.shortName ?? "The client")}
                </button>
              ))}
            </div>
            <select
              data-tip="Nothing is assumed: until a person is picked here, this campaign has no sender."
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="mt-2 w-full cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
            >
              <option value="">Choose a person…</option>
              {(senderSide === "phoenix" ? staffOptions : memberOptions).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.sub ? ` — ${o.sub}` : ""}
                </option>
              ))}
            </select>
          </div>

          {memberOptions.length > 0 && (
            <div className="mt-5 border-t border-white/8 pt-4">
              {picker(
                `Who leads this inside ${client?.shortName ?? "the client"}?`,
                "Their own champion — the person on their side who carries this",
                champion,
                setChampion,
                memberOptions,
                "Nobody yet"
              )}
            </div>
          )}
        </>
      ),
      warning: senderId
        ? undefined
        : "No sender chosen. Lessons cannot go out under a name nobody picked — you will be asked again on the campaign page.",
    },
  ];

  return (
    <Wizard
      title={`New campaign for ${client?.shortName ?? "this client"}`}
      steps={steps}
      finishLabel="Create campaign"
      onClose={onClose}
      onFinish={() => {
        if (!name.trim()) return;
        const id = crypto.randomUUID();
        dispatch({
          type: "addCampaign",
          id,
          clientId,
          name: name.trim(),
          code: code.trim() || "TLE",
          fromTemplateId: templateId || undefined,
          withStandardSessions,
          templateIds: picked,
          timezone,
        });
        const roles = [
          ["phoenix_leader", leader],
          ["phoenix_coach", coach],
          ["project_manager", manager],
        ] as const;
        for (const [role, staffId] of roles)
          if (staffId)
            dispatch({
              type: "addPhoenixAssignment",
              clientId,
              campaignId: id,
              staffId,
              role,
            });
        if (senderId)
          dispatch({
            type: "updateCampaign",
            clientId,
            campaignId: id,
            patch:
              senderSide === "phoenix"
                ? { senderStaffId: senderId, senderMemberId: null }
                : { senderMemberId: senderId, senderStaffId: null },
          });
        if (champion)
          dispatch({
            type: "addClientAssignment",
            clientId,
            campaignId: id,
            memberId: champion,
            role: "champion",
          });
        onCreated?.(id);
        onClose();
      }}
    />
  );
}
