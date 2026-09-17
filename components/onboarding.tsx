"use client";

// Onboarding — the two things everyone does before their program
// starts: accept the user agreement, and join the community. This file
// carries the campaign page's Onboarding section (three sends, each
// with its look-before-you-send confirmation, and the live status of
// every member) and the little status chips reused on the client page.
//
// The two are deliberately independent: neither waits for the other.
// The third send is the nudge — a gentler second email to the people
// who were invited and have not walked through the door yet.

import { useState } from "react";
import { BellRing, DoorOpen, ScrollText } from "lucide-react";
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

/** One onboarding send. Same manners as Send-to-everyone-now: ask the
 *  server who exactly would get it, put those numbers in the
 *  confirmation, only then send. */
function OnboardingSendButton({
  campaignId,
  clientName,
  kind,
  mode = "fresh",
}: {
  campaignId: string;
  clientName: string;
  kind: "agreement" | "invite";
  /** fresh: people who never received it. remind: the ones who did and
   *  have not acted on it yet. */
  mode?: "fresh" | "remind";
}) {
  const confirmSend = useConfirm();
  const [state, setState] = useState<"idle" | "checking" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const api = kind === "agreement" ? "/api/send-agreement" : "/api/send-invite";

  const run = async () => {
    if (state !== "idle") return;
    setMsg(null);
    setState("checking");
    // problems show as a popup, never as text sitting on the page
    const problem = (name: string, detail: string) => {
      setState("idle");
      void confirmSend({ notice: true, name, detail });
    };
    try {
      const headers = { "content-type": "application/json", ...(await authHeaders()) };
      const check = await fetch(`${api}?dryrun=1`, {
        method: "POST",
        headers,
        body: JSON.stringify({ campaignId }),
      }).then((r) => r.json());
      if (!check.ok || check.reason) {
        problem("That cannot be sent yet", check.reason ?? "Something went wrong — try again.");
        return;
      }

      // a reminder goes to the people still sitting on an unanswered
      // email; the agreement button turns into one by itself once
      // nobody new is left
      const waiting = kind === "agreement" ? check.pending : check.invited;
      const remind =
        mode === "remind" || (kind === "agreement" && check.toSend === 0 && waiting > 0);
      const toSend = remind ? waiting : check.toSend;
      if (toSend === 0) {
        problem(
          "Nothing to send",
          mode === "remind"
            ? check.joined
              ? "Nobody is waiting — everyone who was invited has joined."
              : "Nobody has been invited yet, so there is nobody to remind."
            : kind === "agreement"
              ? "Everyone has accepted the user agreement."
              : "Everyone has joined or been invited."
        );
        return;
      }

      const name = remind
        ? kind === "agreement"
          ? "a reminder about the user agreement"
          : "a reminder to join the community"
        : kind === "agreement"
          ? "the user agreement"
          : "the community invitation";
      const detail = [
        kind === "agreement"
          ? remind
            ? `Sends the agreement again, right now, to the ${plural(toSend, "member")} of ${clientName} who received it but have not accepted yet, from ${check.from}.`
            : `Emails the user agreement, right now, to the ${plural(toSend, "member")} of ${clientName} who never received it — each with a personal accept link — from ${check.from}.`
          : remind
            ? `Sends the invitation again, right now, to the ${plural(toSend, "member")} of ${clientName} who were invited but have not joined yet, with the new-member guide attached, from ${check.from}.`
            : `Invites the ${plural(toSend, "member")} of ${clientName} not yet in the community into their space, right now, via the client's own plan link, with the new-member guide attached, from ${check.from}.`,
        kind === "agreement" && check.signed
          ? `${check.signed} already accepted and are skipped.`
          : "",
        kind === "agreement" && !remind && check.pending
          ? `${check.pending} received it earlier and still have to accept — once nobody new is left, this button sends them a reminder.`
          : "",
        kind === "invite" && check.joined ? `${check.joined} already joined and are skipped.` : "",
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
        problem("Sending failed", out.reason ?? "Something went wrong — try again.");
        return;
      }
      setState("done");
      setMsg(
        `Sent to ${out.sent}${out.failed ? `, failed for ${out.failed}` : ""} — updating…`
      );
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      problem("Sending failed", "Could not reach the server — try again.");
    }
  };

  const Icon =
    mode === "remind" ? BellRing : kind === "agreement" ? ScrollText : DoorOpen;
  const label =
    mode === "remind"
      ? "Remind them to join"
      : kind === "agreement"
        ? "Send the user agreement"
        : "Invite to the community";
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        onClick={run}
        disabled={state !== "idle"}
        data-tip={
          mode === "remind"
            ? "A second, gentler email to the people who were invited but have not joined yet — same link, same guide. You see the exact numbers and confirm first."
            : kind === "agreement"
              ? "Email the user agreement to everyone who has not received it — each gets a personal link where their acceptance is recorded. You see the exact numbers and confirm first."
              : "Email the invitation to everyone not yet in the community — via the client's own plan link, with the new-member guide attached. You see the exact numbers and confirm first."
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
              : label}
      </button>
      {msg && <span className="max-w-md text-[11px] text-mist">{msg}</span>}
    </span>
  );
}

/** The three onboarding sends, as a row of buttons. They live in the
 *  header of the participants list, because that list is who they go
 *  to — the people put on this campaign, not everyone at the client. */
export function OnboardingButtons({
  campaignId,
  clientName,
  inviteUrl,
}: {
  campaignId: string;
  clientName: string;
  inviteUrl?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <span className="flex items-center gap-1">
        <OnboardingSendButton campaignId={campaignId} clientName={clientName} kind="agreement" />
        <TestSendButton campaignId={campaignId} kind="agreement" compact tipPos="top" />
      </span>
      <span className="flex items-center gap-1">
        <OnboardingSendButton campaignId={campaignId} clientName={clientName} kind="invite" />
        <TestSendButton campaignId={campaignId} kind="invite" compact tipPos="top" />
      </span>
      <span className="flex items-center gap-1">
        <OnboardingSendButton
          campaignId={campaignId}
          clientName={clientName}
          kind="invite"
          mode="remind"
        />
        <TestSendButton campaignId={campaignId} kind="invite" remind compact tipPos="top" />
      </span>
      {!inviteUrl && (
        <span
          data-tip="Paste the client's plan link into the Invitation link field before inviting anyone"
          className="text-[11px] font-semibold text-[#ff7a55]"
        >
          No invitation link yet
        </span>
      )}
    </div>
  );
}
