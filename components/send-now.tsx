"use client";

// "Send to everyone now" — the explicit, surgical real send of one lesson
// for one campaign. It first asks the server who would get it, puts those
// exact numbers in a confirmation dialog, and only then sends. People who
// already have the lesson are skipped, so it also works as a catch-up for
// members added later. The daily engine and its master switch are not
// involved: this send happens because a person asked for exactly it.

import { useState } from "react";
import { Send } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { useConfirm } from "@/components/confirm";

interface Props {
  campaignId: string;
  stepId: string;
  /** the subject line, quoted in the confirmation */
  subject: string;
  /** the client's short name, named in the confirmation */
  clientName: string;
  /** smaller paddings for the campaign row footer */
  small?: boolean;
}

export function SendNowButton({ campaignId, stepId, subject, clientName, small }: Props) {
  const confirmSend = useConfirm();
  const [state, setState] = useState<"idle" | "checking" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (state !== "idle") return;
    setError(null);
    setMsg(null);
    setState("checking");
    try {
      const headers = {
        "content-type": "application/json",
        ...(await authHeaders()),
      };
      const body = JSON.stringify({ campaignId, stepId });
      const check = await fetch("/api/send-step?dryrun=1", {
        method: "POST",
        headers,
        body,
      }).then((r) => r.json());
      if (!check.ok || check.reason) {
        setError(check.reason ?? "cannot send");
        setState("idle");
        return;
      }
      if (check.members === 0 && check.watchers === 0) {
        setMsg("Everyone already has this email — nothing left to send.");
        setState("idle");
        return;
      }
      const parts = [
        `${check.members} member${check.members === 1 ? "" : "s"} of ${clientName}`,
      ];
      if (check.watchers)
        parts.push(`${check.watchers} watching cop${check.watchers === 1 ? "y" : "ies"}`);
      const detail = [
        `Sends it right now, for real, to ${parts.join(" plus ")}, from ${check.from}.`,
        check.alreadySent
          ? `${check.alreadySent} already have it and are skipped.`
          : "",
        check.noEmail
          ? `${check.noEmail} member${check.noEmail === 1 ? " has" : "s have"} no email address and will show as failed.`
          : "",
        check.engineOn
          ? ""
          : "The daily engine stays OFF — nothing else goes out.",
      ]
        .filter(Boolean)
        .join(" ");
      setState("idle");
      const yes = await confirmSend({
        action: "send",
        name: subject,
        detail,
        verb: "Send now",
      });
      if (!yes) return;
      setState("sending");
      const out = await fetch("/api/send-step", {
        method: "POST",
        headers,
        body,
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

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          run();
        }}
        disabled={state === "checking" || state === "sending" || state === "done"}
        data-tip="Send this email to every member of this campaign right now. You see the exact numbers and confirm before anything leaves."
        className={`flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 font-semibold text-mist transition-colors hover:border-[#4ade80]/50 hover:text-[#4ade80] disabled:opacity-50 ${
          small ? "px-2.5 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
        }`}
      >
        <Send size={small ? 11 : 13} />
        {state === "checking"
          ? "Checking…"
          : state === "sending"
            ? "Sending…"
            : state === "done"
              ? "Sent"
              : "Send to everyone now"}
      </button>
      {error && (
        <span className="max-w-md text-[11px] font-semibold text-[#ff7a55]">{error}</span>
      )}
      {msg && <span className="max-w-md text-[11px] text-mist">{msg}</span>}
    </span>
  );
}
