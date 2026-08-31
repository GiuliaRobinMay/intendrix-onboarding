"use client";

// "Send me a test" — the one implementation, used everywhere an email can
// be read: the mailbox, the lesson list under a campaign's series, and the
// blueprint editor. Wherever it sits, it sends that exact email to the
// signed-in person's own address and nowhere else.

import { useState } from "react";
import { SendHorizonal } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";

export type TestVariant = "participant" | "leader";

interface Props {
  campaignId: string;
  stepId: string;
  variant: TestVariant;
  /** icon only, for a table row; full label elsewhere */
  compact?: boolean;
  /** where the tooltip should open */
  tipPos?: "top" | "bottom" | "right";
  /** names the variant in the tooltip when both versions exist */
  variantLabel?: string;
}

export function TestSendButton({
  campaignId,
  stepId,
  variant,
  compact = false,
  tipPos = "top",
  variantLabel,
}: Props) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const send = async () => {
    if (state === "sending") return;
    setState("sending");
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ campaignId, stepId, variant }),
      });
      const out = await res.json();
      if (out.sent) {
        setState("sent");
        setNote(out.note ?? null);
        setTimeout(() => setState("idle"), 8000);
      } else {
        setState("idle");
        // say what actually went wrong — guessing costs more time than it saves
        setError(out.reason ?? "unknown reason");
      }
    } catch {
      setState("idle");
      setError("could not reach the server");
    }
  };

  const tip =
    state === "sent"
      ? "Sent — check your inbox"
      : `Send ${variantLabel ? `the ${variantLabel} version of ` : ""}this email to your own address as a test. Same sender, same links, marked so it can't be mistaken for the real thing.`;

  if (compact)
    return (
      <span className="relative flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            send();
          }}
          disabled={state === "sending"}
          data-tip={error ? `Could not send — ${error}` : tip}
          data-tip-pos={tipPos}
          className={`cursor-pointer rounded p-1 transition-colors disabled:opacity-50 ${
            error
              ? "text-[#ff7a55]"
              : state === "sent"
                ? "text-[#4ade80]"
                : "text-mist hover:bg-white/8 hover:text-paper"
          }`}
        >
          <SendHorizonal size={12} className={state === "sending" ? "opacity-40" : ""} />
        </button>
      </span>
    );

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        onClick={send}
        disabled={state === "sending"}
        data-tip={tip}
        data-tip-pos={tipPos}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper disabled:opacity-50"
      >
        <SendHorizonal size={13} />
        {state === "sending"
          ? "Sending…"
          : state === "sent"
            ? "Sent to you"
            : variantLabel
              ? `Test the ${variantLabel} version`
              : "Send me a test"}
      </button>
      {error && (
        <span className="max-w-md text-[11px] font-semibold text-[#ff7a55]">{error}</span>
      )}
      {note && <span className="max-w-md text-[11px] text-mist">{note}</span>}
    </span>
  );
}
