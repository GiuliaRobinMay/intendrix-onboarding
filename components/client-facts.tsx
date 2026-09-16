"use client";

// Where a client is, and where their people go: the state that decides
// the sending timezone, the Mighty Networks space, and the invitation
// link their team joins through.
//
// These belong to the client, not to one campaign — so the same card
// appears on the client page and on every campaign of theirs, filled in
// from the same place. Type it once, it is there everywhere.

import { Copy, ExternalLink, TriangleAlert } from "lucide-react";
import { EditableText } from "@/components/editable";
import { US_STATES, stateByCode } from "@/lib/us-states";
import { useData } from "@/lib/state";
import { fmtSendTime } from "@/lib/store";
import type { Client } from "@/lib/types";

export function ClientFactsCard({
  client,
  /** on a campaign page, say out loud whose details these are */
  fromCampaign = false,
}: {
  client: Client;
  fromCampaign?: boolean;
}) {
  const { dispatch } = useData();
  const patch = (p: Parameters<typeof dispatch>[0] extends never ? never : any) =>
    dispatch({ type: "updateClient", clientId: client.id, patch: p });

  const label = "w-24 shrink-0 text-[11px] font-medium text-mist";

  return (
    <section className="card p-5">
      <h2 className="text-base font-bold">Location, space and invitation link</h2>
      <p className="mt-1 mb-4 text-xs text-mist">
        {fromCampaign
          ? `${client.shortName}'s own details — shared by every campaign of theirs, so changing them here changes them everywhere.`
          : "The state decides which timezone new campaigns start in, so emails land at 8:00 AM in the client's own morning. The links are the space their people walk into."}
      </p>

      <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className={label}>State</span>
            <select
              data-tip="The client's US state — new campaigns default to its timezone"
              value={client.state ?? ""}
              onChange={(e) => patch({ state: e.target.value })}
              className={`min-w-0 flex-1 cursor-pointer rounded-md border bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:outline-none ${
                client.state
                  ? "border-white/12 focus:border-white/40"
                  : "border-[#eb320f]/70 bg-[#eb320f]/8 focus:border-[#ff7a55]"
              }`}
            >
              <option value="">— choose a state —</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={label}>City</span>
            <EditableText
              value={client.city ?? ""}
              placeholder="e.g. Ann Arbor"
              onCommit={(v) => patch({ city: v.trim() })}
              className="text-xs"
            />
          </div>
          {client.state ? (
            <p className="text-[11px] text-mist">
              Campaigns for this client start in{" "}
              <span className="font-semibold text-paper">
                {fmtSendTime("08:00", stateByCode(client.state)!.tz).replace("8:00 AM ", "")}
              </span>{" "}
              time.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ff7a55]">
              <TriangleAlert size={12} className="shrink-0" />
              No state chosen — new campaigns fall back to Eastern time.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className={label}>Space</span>
            <EditableText
              value={client.spaceUrl ?? ""}
              placeholder="Paste the space URL…"
              invalid={!client.spaceUrl}
              onCommit={(v) => patch({ spaceUrl: v.trim() })}
              className="text-xs text-mist"
            />
            {client.spaceUrl && (
              <a
                data-tip="Open the client's space in Mighty Networks"
                href={client.spaceUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-mist hover:text-paper"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <span className={label}>Invitation link</span>
            <EditableText
              value={client.inviteUrl ?? ""}
              placeholder="Paste the plan invitation link…"
              invalid={!client.inviteUrl}
              onCommit={(v) => patch({ inviteUrl: v.trim() })}
              className="text-xs text-mist"
            />
            {client.inviteUrl && (
              <button
                data-tip="Copy the invitation link to send it by email"
                onClick={() => navigator.clipboard?.writeText(client.inviteUrl!)}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold text-mist transition-colors hover:border-white/25 hover:text-paper"
              >
                <Copy size={11} /> Copy
              </button>
            )}
          </div>
          {!client.inviteUrl && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ff7a55]">
              <TriangleAlert size={12} className="shrink-0" />
              Without the invitation link nobody can be invited into the community.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
