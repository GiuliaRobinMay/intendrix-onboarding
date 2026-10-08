"use client";

// Who a campaign's emails come from.
//
// This used to be deduced: whoever held the Coach role on the Phoenix
// team card became the sender. Two things made that wrong. Putting a
// colleague on a campaign could change the name a client saw, and with
// two people in the role the mail went out under whichever had been
// added first — which is how CareSouth's lessons arrived from Natalie.
//
// So it is two decisions, both made by hand and neither of them guessed:
// which side the sender is on, and which person on that side. Who is on
// the Phoenix team is a different question, asked on a different card.

import { useState } from "react";
import { Mail } from "lucide-react";
import { useData } from "@/lib/state";
import type { Campaign, Client, StaffMember } from "@/lib/types";
import { findStaff } from "@/lib/store";
import type { EmailSender } from "@/lib/store";

type Side = "phoenix" | "client";

export function SenderPicker({
  client,
  campaign,
  team,
  emailSender,
}: {
  client: Client;
  campaign: Campaign;
  team: StaffMember[];
  emailSender: EmailSender | undefined;
}) {
  const { dispatch } = useData();
  const chosen = Boolean(campaign.senderStaffId || campaign.senderMemberId);
  const [side, setSide] = useState<Side>(
    campaign.senderMemberId ? "client" : "phoenix"
  );

  const set = (patch: { senderStaffId?: string | null; senderMemberId?: string | null }) =>
    dispatch({
      type: "updateCampaign",
      clientId: client.id,
      campaignId: campaign.id,
      // only ever one of the two holds a person
      patch: { senderStaffId: null, senderMemberId: null, ...patch },
    });

  const sideButton = (value: Side, label: string, tip: string) => (
    <button
      key={value}
      data-tip={tip}
      onClick={() => {
        setSide(value);
        // switching sides drops a person who is no longer on the list,
        // so the box never shows a name the dropdown cannot explain
        if (value === "phoenix" && campaign.senderMemberId) set({});
        if (value === "client" && campaign.senderStaffId) set({});
      }}
      className={`flex-1 cursor-pointer rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
        side === value
          ? "bg-white/12 text-paper"
          : "text-mist hover:bg-white/6 hover:text-paper"
      }`}
    >
      {label}
    </button>
  );

  const people: Array<{ id: string; name: string; sub: string | null }> =
    side === "phoenix"
      ? team.map((p) => ({ id: p.id, name: p.name, sub: p.role ?? null }))
      : client.members.map((m) => ({ id: m.id, name: m.name, sub: m.title ?? null }));

  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <Mail size={17} className="text-mist" /> Emails sent from
      </h2>

      <div className="flex gap-1 rounded-lg border border-white/10 bg-navy/60 p-1">
        {sideButton("phoenix", "Phoenix team", "The emails come from one of your own people")}
        {sideButton(
          "client",
          client.shortName,
          `The emails come from someone inside ${client.name} — their own champion introducing the programme`
        )}
      </div>

      <select
        data-tip="Nothing is assumed here: until a person is picked, this campaign has no sender."
        value={
          side === "phoenix"
            ? campaign.senderStaffId
              ? `staff:${campaign.senderStaffId}`
              : ""
            : campaign.senderMemberId
              ? `member:${campaign.senderMemberId}`
              : ""
        }
        onChange={(e) => {
          const id = e.target.value.split(":")[1] ?? null;
          set(side === "phoenix" ? { senderStaffId: id } : { senderMemberId: id });
        }}
        className={`mt-2 w-full cursor-pointer rounded-md border bg-navy/60 px-2.5 py-1.5 text-xs font-semibold focus:outline-none ${
          chosen
            ? "border-white/10 focus:border-white/30"
            : "border-[#ff7a55]/60 text-[#ff7a55]"
        }`}
      >
        <option value="">Choose a person…</option>
        {people.map((p) => (
          <option key={p.id} value={`${side === "phoenix" ? "staff" : "member"}:${p.id}`}>
            {p.name}
            {p.sub ? ` — ${p.sub}` : ""}
          </option>
        ))}
      </select>

      {chosen && emailSender ? (
        <p
          data-tip={
            emailSender.isClientMember
              ? `Replies go to ${emailSender.replyTo}`
              : "The address recipients see"
          }
          className="mt-2 truncate text-[11px] text-mist"
        >
          {emailSender.name} &lt;{emailSender.address}&gt;
        </p>
      ) : (
        // Nothing chosen. Until the backfill has run, a role still
        // decides in the background — so say whose name would go out,
        // rather than letting it be a surprise in somebody's inbox.
        <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#ff7a55]">
          Nobody chosen.
          {emailSender
            ? ` Lessons would go out as ${emailSender.name}, picked from the team card — choose someone here instead.`
            : " Nothing can go out until someone is picked."}
        </p>
      )}

      {chosen && emailSender?.isClientMember && !emailSender.replyTo.includes("@") && (
        <p className="mt-2 text-[11px] font-semibold text-[#ff7a55]">
          {emailSender.name} has no address — replies have nowhere to go.
        </p>
      )}

      {/* Watching from the outside: one copy per lesson, not per member.
          It belongs on this card because it is the same question — who
          sees this mail — only asked about the people who are not on it. */}
      <label className="mt-4 block border-t border-white/8 pt-3">
        <span className="text-[11px] font-medium text-mist">
          Send a copy of everything to
        </span>
        <input
          type="text"
          defaultValue={campaign.shadowEmails ?? ""}
          placeholder="amber@phoenixperform.com"
          data-tip="Comma-separated. One copy of each lesson, once — not one per member, no personalisation, and they stay off the participants list."
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next === (campaign.shadowEmails ?? "").trim()) return;
            dispatch({
              type: "updateCampaign",
              clientId: client.id,
              campaignId: campaign.id,
              patch: { shadowEmails: next || null },
            });
          }}
          className="mt-1 w-full rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-xs focus:border-white/30 focus:outline-none"
        />
      </label>

      {!chosen &&
        (() => {
          // two holders of one role is a coin toss, and it decided for
          // weeks. It only matters while nobody has been chosen here.
          const coaches = campaign.phoenixTeam.filter((a) => a.role === "phoenix_coach");
          if (coaches.length < 2) return null;
          const names = coaches
            .map((a) => findStaff(team, a.staffId)?.name ?? "someone")
            .join(" and ");
          return (
            <p className="mt-2 text-[11px] leading-relaxed text-mist">
              {names} are both set as Coach on the team card, which is why this
              cannot be left to decide itself.
            </p>
          );
        })()}
    </section>
  );
}
