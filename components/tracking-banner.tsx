"use client";

// Is anybody opening these?
//
// Opens and clicks are recorded end to end — the provider reports them,
// the webhook writes them down, the Mailbox shows them per person. All
// of that is useless until the tracking subdomain resolves: Resend
// rewrites every link through links.phoenixperform.com and serves the
// open pixel from it, so while that CNAME is unverified every email
// stops at "delivered" no matter who reads it.
//
// That failure is silent, and silence here reads as "nobody opens our
// email" — the most expensive wrong conclusion this app could invite.
// So once there is enough delivered mail for the silence to mean
// something, it is named.

import { MousePointerClick } from "lucide-react";
import type { Client } from "@/lib/types";

/** Below this, no opens is just a small sample. */
const ENOUGH = 20;

export function TrackingBanner({ clients }: { clients: Client[] }) {
  let delivered = 0;
  let opened = 0;
  let clicked = 0;
  for (const client of clients)
    for (const campaign of client.campaigns)
      for (const row of Object.values(campaign.delivery ?? {})) {
        delivered += row.delivered;
        opened += row.opened;
        clicked += row.clicked;
      }

  if (delivered < ENOUGH || opened > 0 || clicked > 0) return null;

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#facc15]/35 bg-[#facc15]/10 p-3">
      <MousePointerClick size={15} className="mt-0.5 shrink-0 text-[#facc15]" />
      <div className="min-w-0 text-[11px] leading-relaxed">
        <p className="font-bold text-[#facc15]">
          {delivered} emails delivered, and not one open or click recorded.
        </p>
        <p className="mt-0.5 text-mist">
          That is the tracking domain, not the readers. Resend sends both the
          open pixel and every rewritten link through{" "}
          <span className="font-mono">links.phoenixperform.com</span>, and until
          that CNAME is verified every email stops at &ldquo;delivered&rdquo;
          however many people read it. Nothing here needs changing — it starts
          working on its own the moment the record resolves.
        </p>
      </div>
    </div>
  );
}
