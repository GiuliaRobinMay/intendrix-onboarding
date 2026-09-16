"use client";

// One person's mailbox: every email Intendrix ever sent them, and what
// the provider said happened to it — delivered, opened, clicked, or
// bounced. The client page only flags that something is wrong; this is
// where you see what, and when.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { OnboardingChips, OnboardingLegend } from "@/components/onboarding";
import { useData } from "@/lib/state";
import { fmtDate } from "@/lib/store";

interface Row {
  title: string;
  campaign: string;
  status: string;
  error: string | null;
  event: string | null;
  at: string | null;
}

/** what the send log + the provider say about one email */
const STATE: Record<string, { text: string; color: string; tip: string }> = {
  clicked: {
    text: "clicked",
    color: "var(--tone-green)",
    tip: "Delivered, opened, and a link was clicked",
  },
  opened: { text: "opened", color: "var(--tone-green)", tip: "Delivered and opened" },
  delivered: {
    text: "delivered",
    color: "var(--color-mist)",
    tip: "Accepted by their mail server — no sign of it being opened yet",
  },
  delivery_delayed: {
    text: "delayed",
    color: "var(--tone-yellow)",
    tip: "Their mail server is holding it — usually it still arrives",
  },
  bounced: {
    text: "bounced",
    color: "#ff7a55",
    tip: "Refused by their mail server — the address is wrong or closed",
  },
  complained: {
    text: "marked as spam",
    color: "#ff7a55",
    tip: "They reported it as spam — stop sending to this address",
  },
  failed: { text: "failed", color: "#ff7a55", tip: "It never left — see the reason" },
  held: { text: "held", color: "var(--tone-yellow)", tip: "Waiting, not sent yet" },
  scheduled: { text: "scheduled", color: "var(--color-mist)", tip: "Still ahead" },
  sent: {
    text: "sent",
    color: "var(--color-mist)",
    tip: "Handed to the provider — no delivery report yet",
  },
};

const stateOf = (r: Row) =>
  r.status === "sent"
    ? STATE[r.event ?? "sent"] ?? STATE.sent
    : STATE[r.status] ?? { text: r.status, color: "#ff7a55", tip: r.error ?? r.status };

export default function MemberMailPage() {
  const { id } = useParams<{ id: string }>();
  const { clients } = useData();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const found = clients
    .flatMap((c) => c.members.map((m) => ({ client: c, member: m })))
    .find((x) => x.member.id === id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/member-history?memberId=${encodeURIComponent(id)}`,
          { headers: await authHeaders() }
        );
        const out = await res.json();
        if (cancelled) return;
        if (out.rows) setRows(out.rows);
        else setErr(out.error ?? "could not load the emails");
      } catch {
        if (!cancelled) setErr("could not reach the server");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!found)
    return (
      <div className="card p-10 text-center text-sm text-mist">
        This person is no longer on any client.{" "}
        <Link href="/clients" className="font-semibold text-paper underline">
          Back to clients
        </Link>
      </div>
    );

  const { client, member } = found;
  const counts = {
    all: rows?.length ?? 0,
    delivered:
      rows?.filter((r) => ["delivered", "opened", "clicked"].includes(r.event ?? ""))
        .length ?? 0,
    opened: rows?.filter((r) => ["opened", "clicked"].includes(r.event ?? "")).length ?? 0,
    clicked: rows?.filter((r) => r.event === "clicked").length ?? 0,
    trouble:
      rows?.filter(
        (r) =>
          ["bounced", "complained", "failed"].includes(r.event ?? "") ||
          r.status === "failed"
      ).length ?? 0,
  };

  return (
    <>
      <Link
        href={`/clients/${client.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> {client.shortName}
      </Link>

      <section className="card mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-bold">
              {member.name}
              {member.status === "inactive" && (
                <span className="rounded bg-[#eb320f]/15 px-2 py-0.5 text-[10px] font-bold text-[#ff7a55]">
                  LEFT THE TEAM
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-mist">
              {member.title ? `${member.title} · ` : ""}
              {client.name}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Mail size={13} className="text-mist" />
              <span className={member.email ? "text-paper" : "font-semibold text-[#ff7a55]"}>
                {member.email || "no email address"}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <OnboardingChips member={member} />
            <OnboardingLegend />
          </div>
        </div>

        {member.note && (
          <p className="mt-4 rounded-md border border-white/10 bg-navy/40 px-3 py-2 text-xs text-mist">
            {member.note}
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="flex flex-wrap items-baseline gap-x-3 text-base font-bold">
          Emails
          {rows && (
            <span className="text-xs font-medium text-mist">
              {counts.all} sent · {counts.delivered} delivered · {counts.opened} opened ·{" "}
              {counts.clicked} clicked
              {counts.trouble ? ` · ${counts.trouble} that did not arrive` : ""}
            </span>
          )}
        </h2>
        <p className="mt-1 mb-4 text-xs text-mist">
          Newest first. What you see here is what the mail provider reported back —
          opens and clicks are a hint, not a promise: some mail apps hide them.
        </p>

        {err && <p className="text-sm font-semibold text-[#ff7a55]">{err}</p>}
        {!rows && !err && <p className="text-sm text-mist">Loading…</p>}
        {rows && rows.length === 0 && (
          <p className="text-sm text-mist">Nothing has been sent to them yet.</p>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[36rem]">
              <div className="grid grid-cols-[minmax(0,2fr)_7rem_7rem_8rem] gap-x-4 border-b border-white/8 pb-1.5 text-[11px] font-medium text-mist">
                <span>Lesson</span>
                <span>Campaign</span>
                <span>Date</span>
                <span>What happened</span>
              </div>
              {rows.map((r, i) => {
                const s = stateOf(r);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,2fr)_7rem_7rem_8rem] items-baseline gap-x-4 border-b border-white/5 py-2 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-sm">{r.title}</span>
                    <span className="truncate text-xs text-mist">{r.campaign}</span>
                    <span className="text-xs tabular-nums text-mist">
                      {r.at ? fmtDate(new Date(r.at)) : "—"}
                    </span>
                    <span
                      data-tip={r.error ? `${s.tip} — ${r.error}` : s.tip}
                      className="text-xs font-semibold"
                      style={{ color: s.color }}
                    >
                      {s.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
