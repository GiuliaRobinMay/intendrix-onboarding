"use client";

// Every email, one line per person, searchable.
//
// The question always arrives sideways: "Todd says he never got it."
// Not which campaign, not which lesson. So this page starts from the
// person — or the company, or the address, or whatever fragment you
// have — and shows every email that went to them and what became of
// each one. Click a row and you are on that person's own mailbox.
//
// The campaign page still has the per-lesson view; this is the same
// log turned the other way round.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Copy, MailSearch, Search, X } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { PageHeader } from "@/components/ui";
import { usDate } from "@/lib/dates";
import { emailState, emailTroubled } from "@/lib/email-state";

interface Row {
  id: string;
  name: string;
  email: string;
  copy: boolean;
  memberId: string | null;
  clientId: string;
  client: string;
  campaignId: string;
  campaign: string;
  campaignCode: string;
  lesson: string;
  lessonCode: string | null;
  status: string;
  error: string | null;
  event: string | null;
  at: string | null;
  sent: boolean;
}

type Scope = "all" | "trouble" | "notsent";

const SCOPES: Array<{ id: Scope; label: string; tip: string }> = [
  { id: "all", label: "All", tip: "Every email, newest first" },
  {
    id: "trouble",
    label: "Problems",
    tip: "Bounced, reported as spam, or refused on the way out",
  },
  { id: "notsent", label: "Not sent", tip: "Scheduled or held — nothing has left yet" },
];

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function EmailLogPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // the search runs on the server — the log is far bigger than the
  // page — a beat after you stop typing, so each keystroke is not a
  // round trip
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim(), scope });
        const res = await fetch(`/api/email-log?${params}`, {
          headers: await authHeaders(),
        });
        const out = await res.json();
        if (cancelled) return;
        if (out.rows) {
          setRows(out.rows);
          setTotal(out.total ?? out.rows.length);
          setErr(null);
        } else setErr(out.error ?? "could not load the emails");
      } catch {
        if (!cancelled) setErr("could not reach the server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, scope]);

  useEffect(() => inputRef.current?.focus(), []);

  const shown = rows?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Email log"
        subtitle="Every email that went to a person, newest first. Search a name, an address, a company, a campaign or a lesson."
      />

      {/* search + scope on one line, with the count on the far side */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-72 flex-1 sm:max-w-md">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Who are you looking for?"
            className="h-9 w-full rounded-md border border-white/10 bg-navy/60 pl-9 pr-8 text-sm focus:border-white/30 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              data-tip="Clear"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-mist hover:text-paper"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-white/10 p-0.5">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              data-tip={s.tip}
              onClick={() => setScope(s.id)}
              className={`cursor-pointer rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                scope === s.id
                  ? "brand-gradient-soft text-paper"
                  : "text-mist hover:text-paper"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="ml-auto text-xs text-mist">
          {loading
            ? "Looking…"
            : total > shown
              ? `Showing the newest ${shown} of ${total.toLocaleString("en-US")} — narrow the search to see the rest`
              : `${shown} email${shown === 1 ? "" : "s"}`}
        </p>
      </div>

      {err ? (
        <div className="card p-10 text-center text-sm text-mist">{err}</div>
      ) : rows && rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <MailSearch size={22} className="text-mist/50" />
          <p className="text-sm text-mist">
            {query
              ? `Nothing sent to anyone matching "${query}".`
              : scope === "trouble"
                ? "No bounces, no spam reports, nothing refused."
                : scope === "notsent"
                  ? "Nothing waiting to go out."
                  : "No emails have been sent yet."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/8 text-[11px] font-semibold text-mist">
                <th className="px-4 py-2.5 font-semibold">When</th>
                <th className="px-3 py-2.5 font-semibold">Who</th>
                <th className="px-3 py-2.5 font-semibold">Client</th>
                <th className="px-3 py-2.5 font-semibold">Campaign</th>
                <th className="px-3 py-2.5 font-semibold">Lesson</th>
                <th className="px-4 py-2.5 font-semibold">What happened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(rows ?? []).map((r) => {
                const st = emailState(r);
                const trouble = emailTroubled(r);
                // the name is the way into one person's full mailbox;
                // a copy to a shadow address has no person behind it
                const who = r.memberId ? (
                  <Link
                    href={`/members/${r.memberId}`}
                    className="font-bold hover:underline"
                  >
                    {r.name}
                  </Link>
                ) : (
                  <span className="font-bold">{r.name}</span>
                );
                return (
                  <tr
                    key={r.id}
                    onClick={() => r.memberId && router.push(`/members/${r.memberId}`)}
                    className={`transition-colors hover:bg-white/4 ${
                      r.memberId ? "cursor-pointer" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 align-top">
                      {r.at ? (
                        <>
                          <span className="block font-semibold">{usDate(new Date(r.at))}</span>
                          <span className="block text-[11px] text-mist">{timeOf(r.at)}</span>
                        </>
                      ) : (
                        <span className="text-mist">—</span>
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-2.5 align-top">
                      <span className="flex items-center gap-1.5">
                        {who}
                        {r.copy && (
                          <span
                            data-tip="A copy, sent to the address that follows everything"
                            className="inline-flex items-center gap-0.5 rounded bg-white/8 px-1 text-[10px] font-semibold text-mist"
                          >
                            <Copy size={9} /> copy
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-mist">{r.email}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Link
                        href={`/clients/${r.clientId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold hover:underline"
                      >
                        {r.client}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Link
                        href={`/campaigns/${r.campaignId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {r.campaign}
                      </Link>
                      <span className="block text-[11px] text-mist">{r.campaignCode}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {r.lessonCode && (
                        <span className="mr-1.5 font-semibold text-mist">{r.lessonCode}</span>
                      )}
                      {r.lesson}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <span
                        data-tip={st.tip}
                        className="inline-flex items-center gap-1.5 font-semibold"
                        style={{ color: st.color }}
                      >
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: st.color }}
                        />
                        {st.text}
                      </span>
                      {trouble && r.error && (
                        <span className="block max-w-64 truncate text-[11px] text-mist">
                          {r.error}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
