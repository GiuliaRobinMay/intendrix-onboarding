"use client";

// Onboarding — the two steps everyone walks before their programme
// starts: accept the user agreement, then join the community. This file
// carries the campaign page's Onboarding section (the two send buttons
// with their look-before-you-send confirmations, and the live status of
// every member) and the little status chips reused on the client page.
//
// The order is enforced server-side: the community invitation only ever
// goes to people who have accepted the agreement.

import { useState } from "react";
import { DoorOpen, ScrollText } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { useConfirm } from "@/components/confirm";
import { TestSendButton } from "@/components/test-send";
import type { Member } from "@/lib/types";

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** agreement + community state of one member: just a document and a
 *  door — green once they signed / joined, no text. The story lives in
 *  the tooltips. */
export function OnboardingChips({ member }: { member: Member }) {
  const agreement = member.agreementSignedAt
    ? {
        color: "#4ade80",
        tip: `Accepted the user agreement on ${fmtShort(member.agreementSignedAt)}`,
      }
    : member.agreementSentAt
      ? {
          color: "#facc15",
          tip: `Agreement sent ${fmtShort(member.agreementSentAt)} — not accepted yet`,
        }
      : {
          color: "#5a5c6b",
          tip: "The user agreement has not been sent to them yet",
        };
  const community = member.communityJoinedAt
    ? { color: "#6ea8ff", tip: "In the community" }
    : member.communityInvitedAt
      ? {
          color: "#facc15",
          tip: `Invited ${fmtShort(member.communityInvitedAt)} — has not joined yet`,
        }
      : {
          color: "#5a5c6b",
          tip: "Not invited into the community yet",
        };
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span data-tip={agreement.tip} className="flex items-center" style={{ color: agreement.color }}>
        <ScrollText size={12} />
      </span>
      <span data-tip={community.tip} className="flex items-center" style={{ color: community.color }}>
        <DoorOpen size={12} />
      </span>
    </span>
  );
}

/** one quiet line saying what the two little icons mean */
export function OnboardingLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mist">
      <span className="flex items-center gap-1">
        <ScrollText size={12} className="text-[#4ade80]" /> agreement — green once
        accepted
      </span>
      <span className="flex items-center gap-1">
        <DoorOpen size={12} className="text-[#6ea8ff]" /> community — blue once
        joined
      </span>
      <span>yellow = sent, waiting on them · grey = not yet</span>
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One of the two onboarding sends. Same manners as Send-to-everyone-now:
 *  ask the server who exactly would get it, put those numbers in the
 *  confirmation, only then send. When nobody fresh is left but people
 *  are still sitting on an unanswered email, the same button offers the
 *  reminder instead. */
function OnboardingSendButton({
  campaignId,
  clientName,
  kind,
}: {
  campaignId: string;
  clientName: string;
  kind: "agreement" | "invite";
}) {
  const confirmSend = useConfirm();
  const [state, setState] = useState<"idle" | "checking" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = kind === "agreement" ? "/api/send-agreement" : "/api/send-invite";

  const run = async () => {
    if (state !== "idle") return;
    setError(null);
    setMsg(null);
    setState("checking");
    try {
      const headers = { "content-type": "application/json", ...(await authHeaders()) };
      const check = await fetch(`${api}?dryrun=1`, {
        method: "POST",
        headers,
        body: JSON.stringify({ campaignId }),
      }).then((r) => r.json());
      if (!check.ok || check.reason) {
        setError(check.reason ?? "cannot send");
        setState("idle");
        return;
      }

      // what this click would do: the fresh send, or — with nobody fresh
      // left — the reminder to those who have not answered
      const waiting = kind === "agreement" ? check.pending : check.invited;
      const remind = check.toSend === 0 && waiting > 0;
      const toSend = remind ? waiting : check.toSend;
      if (toSend === 0) {
        setMsg(
          kind === "agreement"
            ? "Everyone has accepted the user agreement — nothing to send."
            : check.needAgreement
              ? `Nothing to send: ${plural(check.joined, "member")} already joined, and ${check.needAgreement} still need to accept the user agreement first.`
              : "Everyone who accepted the agreement has joined or been invited — nothing to send."
        );
        setState("idle");
        return;
      }

      const name = remind
        ? kind === "agreement"
          ? "a reminder about the user agreement"
          : "a reminder about the community invitation"
        : kind === "agreement"
          ? "the user agreement"
          : "the community invitation";
      const detail = [
        kind === "agreement"
          ? remind
            ? `Sends the agreement again, right now, to the ${plural(toSend, "member")} of ${clientName} who received it but have not accepted yet, from ${check.from}.`
            : `Emails the user agreement, right now, to the ${plural(toSend, "member")} of ${clientName} who never received it — each with a personal accept link — from ${check.from}.`
          : remind
            ? `Sends the invitation again, right now, to the ${plural(toSend, "member")} of ${clientName} who were invited but have not joined yet, from ${check.from}.`
            : `Invites the ${plural(toSend, "member")} of ${clientName} who accepted the agreement into the community, right now, via the client's own plan link, from ${check.from}.`,
        kind === "agreement" && check.signed
          ? `${check.signed} already accepted and are skipped.`
          : "",
        kind === "agreement" && !remind && check.pending
          ? `${check.pending} received it earlier and still have to accept — once nobody new is left, this button sends them a reminder.`
          : "",
        kind === "invite" && check.joined ? `${check.joined} already joined and are skipped.` : "",
        kind === "invite" && check.needAgreement
          ? `${plural(check.needAgreement, "member")} have not accepted the user agreement and are held back until they do.`
          : "",
        check.noEmail
          ? `${plural(check.noEmail, "member")} have no email address and are skipped.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      setState("idle");
      const yes = await confirmSend({ action: "send", name, detail, verb: "Send now" });
      if (!yes) return;
      setState("sending");
      const out = await fetch(api, {
        method: "POST",
        headers,
        body: JSON.stringify({ campaignId, ...(remind ? { remind: true } : {}) }),
      }).then((r) => r.json());
      if (!out.ok) {
        setError(out.reason ?? "sending failed");
        setState("idle");
        return;
      }
      setState("done");
      setMsg(
        `Sent to ${out.sent}${out.failed ? `, failed for ${out.failed}` : ""} — updating…`
      );
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setError("could not reach the server");
      setState("idle");
    }
  };

  const Icon = kind === "agreement" ? ScrollText : DoorOpen;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        onClick={run}
        disabled={state !== "idle"}
        data-tip={
          kind === "agreement"
            ? "Email the user agreement to everyone who has not received it — each gets a personal link where their acceptance is recorded. You see the exact numbers and confirm first."
            : "Email the community invitation to everyone who accepted the agreement — via the client's own plan link. You see the exact numbers and confirm first."
        }
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-[#4ade80]/50 hover:text-[#4ade80] disabled:opacity-50"
      >
        <Icon size={13} />
        {state === "checking"
          ? "Checking…"
          : state === "sending"
            ? "Sending…"
            : state === "done"
              ? "Sent"
              : kind === "agreement"
                ? "Send the user agreement"
                : "Invite to the community"}
      </button>
      {error && (
        <span className="max-w-md text-[11px] font-semibold text-[#ff7a55]">{error}</span>
      )}
      {msg && <span className="max-w-md text-[11px] text-mist">{msg}</span>}
    </span>
  );
}

/** The campaign page's Onboarding card: send buttons and everyone's
 *  live status. Works on the client's whole members list — the same
 *  people the campaign's emails go to. */
export function OnboardingSection({
  campaignId,
  clientName,
  members,
  inviteUrl,
}: {
  campaignId: string;
  clientName: string;
  members: Member[];
  inviteUrl?: string;
}) {
  const signed = members.filter((m) => m.agreementSignedAt).length;
  const joined = members.filter((m) => m.communityJoinedAt).length;
  return (
    <section className="card mb-6 p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <ScrollText size={17} className="text-mist" /> Onboarding
        {members.length > 0 && (
          <span className="text-sm font-medium text-mist">
            — {signed} of {members.length} accepted the agreement · {joined} in
            the community
          </span>
        )}
      </h2>
      <p className="mt-1 mb-4 text-xs text-mist">
        Two steps before the programme starts: everyone accepts the user
        agreement — each click is recorded as proof — and then gets their
        personal invitation into the {clientName} community. The invitation
        only ever goes to people who have accepted.
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1">
          <OnboardingSendButton campaignId={campaignId} clientName={clientName} kind="agreement" />
          <TestSendButton campaignId={campaignId} kind="agreement" compact tipPos="top" />
        </span>
        <span className="flex items-center gap-1">
          <OnboardingSendButton campaignId={campaignId} clientName={clientName} kind="invite" />
          <TestSendButton campaignId={campaignId} kind="invite" compact tipPos="top" />
        </span>
        {!inviteUrl && (
          <span className="text-[11px] font-semibold text-[#ff7a55]">
            No invitation link yet — paste the client&rsquo;s plan link into
            the Invite field on the client page first.
          </span>
        )}
      </div>
      {members.length > 0 && (
        <div className="mt-4 border-t border-white/8 pt-3">
          <OnboardingLegend />
          <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {[...members]
              .sort((x, y) => x.name.localeCompare(y.name))
              .map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="min-w-0 truncate text-xs text-mist">{m.name}</span>
                  <OnboardingChips member={m} />
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
