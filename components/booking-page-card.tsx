"use client";

// The booking page: one address for the community, built from the Team
// page. Everyone with a scheduling link is on it; nobody else is. The
// card gives the address and a finished embed code, so what lands on the
// clipboard can be pasted into the "Schedule a Coaching Call" lesson as
// it is.

import { useState } from "react";
import { CalendarClock, ExternalLink } from "lucide-react";
import { GhostButton } from "@/components/ui";
import { useData } from "@/lib/state";

export function BookingPageCard() {
  const { staff } = useData();
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/book`;
  const embed =
    `<iframe src="${url}" title="Schedule a coaching call" ` +
    `style="width:100%;height:520px;border:none;border-radius:14px" loading="lazy"></iframe>`;
  const listed = staff.filter((s) => s.schedulingUrl);

  const copy = (what: "link" | "embed") => {
    navigator.clipboard?.writeText(what === "link" ? url : embed);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="card self-start p-5">
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold">
        <CalendarClock size={17} className="text-mist" /> Booking page
      </h2>
      <p className="text-xs leading-relaxed text-mist">
        One page for the community: every person above who has a scheduling
        link, with their photo and a <em>Schedule a call</em> button. Paste the
        embed code into the <strong>Schedule a Coaching Call</strong> lesson,
        exactly as it is.
      </p>
      <p className="mt-3 text-xs text-mist">
        {listed.length === 0
          ? "Nobody has a scheduling link yet, so the page is empty."
          : `On it now: ${listed.map((s) => s.name).join(", ")}.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={url || "/book"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-mist transition-colors hover:border-white/25 hover:text-paper"
        >
          <ExternalLink size={12} /> Open the page
        </a>
        <GhostButton onClick={() => copy("link")} data-tip="The address alone">
          {copied === "link" ? "Copied" : "Copy the address"}
        </GhostButton>
        <GhostButton onClick={() => copy("embed")} data-tip="The whole embed code, ready for the lesson">
          {copied === "embed" ? "Copied — paste it as it is" : "Copy the embed code"}
        </GhostButton>
      </div>
    </section>
  );
}
