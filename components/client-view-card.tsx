"use client";

// The page the client team sees in their own space in the community.
//
// One link per campaign, which is also how you choose what a given
// space shows: paste that campaign's link into that team's space and it
// is locked to that programme. Clearing the link takes the page down
// without touching anything else.
//
// The page shows only what has actually been sent. Nothing ahead of
// them is visible, so it cannot spoil a lesson or promise one that has
// not arrived.

import { useState } from "react";
import { Check, Copy, ExternalLink, Monitor } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { useData } from "@/lib/state";
import type { Campaign } from "@/lib/types";

/** A secret long enough that the address is the only way in. */
function newToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function ClientViewCard({
  clientId,
  clientName,
  campaign,
}: {
  clientId: string;
  clientName: string;
  campaign: Campaign;
}) {
  const { dispatch } = useData();
  const confirmOff = useConfirm();
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);

  const token = campaign.shareToken ?? null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = token ? `${origin}/journey/${token}` : "";
  // Mighty Networks takes a plain iframe. The title names this client
  // and this programme, so what lands on the clipboard is finished —
  // a placeholder in copied code reads as a blank to fill in, and the
  // person pasting it has no way of knowing it is not.
  const embed =
    `<iframe src="${url}" title="${campaign.name} — ${clientName}" ` +
    `style="width:100%;height:820px;border:none;border-radius:14px" loading="lazy"></iframe>`;

  const copy = (what: "link" | "embed") => {
    navigator.clipboard?.writeText(what === "link" ? url : embed);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <Monitor size={16} className="text-mist" /> The team&rsquo;s own page
      </h2>

      {!token ? (
        <>
          <p className="mb-3 text-xs leading-relaxed text-mist">
            A page for this team&rsquo;s space in the community: every lesson
            they have been sent, newest open, the rest to walk back through.
            Nothing still to come is shown.
          </p>
          <button
            onClick={() =>
              dispatch({
                type: "updateCampaign",
                clientId,
                campaignId: campaign.id,
                patch: { shareToken: newToken() },
              })
            }
            className="brand-gradient cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Create the page
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-white/12 bg-navy/60 px-2 py-1.5 font-mono text-[11px] text-mist focus:border-white/30 focus:outline-none"
            />
            <button
              data-tip="Copy the link"
              onClick={() => copy("link")}
              className="shrink-0 cursor-pointer rounded-md border border-white/12 p-1.5 text-mist transition-colors hover:border-white/30 hover:text-paper"
            >
              {copied === "link" ? <Check size={13} className="text-[#4ade80]" /> : <Copy size={13} />}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              data-tip="See it as they will"
              className="shrink-0 rounded-md border border-white/12 p-1.5 text-mist transition-colors hover:border-white/30 hover:text-paper"
            >
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => copy("embed")}
              data-tip="The whole embed code, ready for the space"
              className="cursor-pointer rounded-md border border-white/12 px-2.5 py-1 text-[11px] font-semibold text-mist transition-colors hover:border-white/30 hover:text-paper"
            >
              {copied === "embed" ? "Copied — paste it as it is" : "Copy the embed code"}
            </button>
            <button
              onClick={async () => {
                if (
                  await confirmOff({
                    name: "this team's page",
                    detail:
                      "The link stops working immediately, wherever it has been embedded. Making a new one later gives a different address.",
                    verb: "Take it down",
                  })
                )
                  dispatch({
                    type: "updateCampaign",
                    clientId,
                    campaignId: campaign.id,
                    patch: { shareToken: null },
                  });
              }}
              className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold text-mist/70 transition-colors hover:text-[#ff7a55]"
            >
              Take it down
            </button>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-mist/70">
            Paste the embed code into the space exactly as it is — there is
            nothing to fill in. Anyone with the link can read it, so it belongs
            in their space and not on a public page.
          </p>
        </>
      )}
    </section>
  );
}
