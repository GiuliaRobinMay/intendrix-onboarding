"use client";

// Every client's corner of the community, on one page.
//
// Three links belong to each client in Mighty Networks — the space, the
// plan that opens it, the invitation that joins through the plan — and
// they used to live in a spreadsheet column and in people's heads. Here
// they sit side by side, red where one is missing, editable in place.
//
// Under the links: who of the client's people is actually inside, read
// live from the community's member list, and who is not yet. And the
// list worth a human minute — somebody inside on this client's plan
// whom the client's own list does not know.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { PageHeader, GhostButton } from "@/components/ui";
import { EditableText } from "@/components/editable";
import { useData } from "@/lib/state";
import { usDate } from "@/lib/dates";
import type { Client, Member } from "@/lib/types";

interface Person {
  email: string;
  name: string | null;
  plan: string | null;
  joinedAt: string | null;
}

interface Live {
  at: string;
  total: number;
  withoutEmail: number;
  /** clientId → memberId → what the roster said */
  found: Record<string, Record<string, { joinedAt: string | null }>>;
  /** clientId → people inside on that client's plan, on nobody's list */
  extra: Record<string, Person[]>;
  unplaced: Person[];
}

type LinkKey = "spaceUrl" | "planUrl" | "inviteUrl";

const LINKS: Array<{ key: LinkKey; label: string; tip: string; placeholder: string }> = [
  {
    key: "spaceUrl",
    label: "Space",
    tip: "Where the client's team meets — their space under TEAM CONNECT",
    placeholder: "Paste the space URL…",
  },
  {
    key: "planUrl",
    label: "Plan",
    tip: "The access rule that opens that space — the plan the invitation link is made from",
    placeholder: "Paste the plan URL…",
  },
  {
    key: "inviteUrl",
    label: "Invitation",
    tip: "What a member clicks to join — the plan's landing page link, the only one you ever send",
    placeholder: "Paste the plan invitation link…",
  },
];

const active = (m: Member) => !m.status || m.status === "active";

export default function CommunityPage() {
  const { clients, dispatch } = useData();
  const [live, setLive] = useState<Live | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community", { headers: await authHeaders() });
      const out = await res.json();
      if (out.ok) {
        setLive(out);
        setReason(null);
      } else setReason(out.reason ?? "could not read the community");
    } catch {
      setReason("could not reach the server");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  // the stamping pass: writes "joined" on every member the roster
  // has, so the client pages and the reminder button agree with this one
  const check = async () => {
    setChecking(true);
    try {
      await fetch("/api/community-sync", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: "{}",
      });
      await load();
    } finally {
      setChecking(false);
    }
  };

  const q = query.trim().toLowerCase();
  const rows = [...clients]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) =>
      q
        ? `${c.name} ${c.shortName} ${c.members.map((m) => `${m.name} ${m.email}`).join(" ")}`
            .toLowerCase()
            .includes(q)
        : true
    );

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const missingLinks = clients.reduce(
    (n, c) => n + LINKS.filter((l) => !c[l.key]).length,
    0
  );

  return (
    <>
      <PageHeader
        title="Community"
        subtitle="Each client's space, plan and invitation link — and who of their people is inside."
        action={
          <GhostButton
            onClick={check}
            tip="Read the community's member list again and mark everyone it has as joined"
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
              {checking ? "Checking…" : "Check who joined"}
            </span>
          </GhostButton>
        }
      />

      {/* one line on the state of the connection, never a paragraph */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1 sm:max-w-sm">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a client or a person…"
            className="h-9 w-full rounded-md border border-white/10 bg-navy/60 pl-9 pr-3 text-sm focus:border-white/30 focus:outline-none"
          />
        </div>
        <p className="ml-auto flex items-center gap-1.5 text-xs text-mist">
          {loading ? (
            "Reading the community…"
          ) : live ? (
            <>
              <Check size={13} className="text-[#4ade80]" />
              {live.total} people in the community
              {live.withoutEmail
                ? ` · ${live.withoutEmail} without a visible address`
                : ""}
              {missingLinks ? ` · ${missingLinks} link${missingLinks === 1 ? "" : "s"} missing` : ""}
            </>
          ) : (
            <>
              <TriangleAlert size={13} className="text-[#ff7a55]" />
              {reason} — showing the last check
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {rows.map((client) => (
          <ClientBlock
            key={client.id}
            client={client}
            live={live}
            open={open.has(client.id) || Boolean(q)}
            onToggle={() => toggle(client.id)}
            onLink={(key, value) =>
              dispatch({ type: "updateClient", clientId: client.id, patch: { [key]: value } })
            }
          />
        ))}
        {rows.length === 0 && (
          <div className="card p-10 text-center text-sm text-mist">No client matches.</div>
        )}
      </div>

      {live && live.unplaced.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Globe size={15} className="text-mist" />
            In the community, on no client's list
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-mist">
              {live.unplaced.length}
            </span>
          </h2>
          <p className="mt-1 text-[11px] text-mist">
            The Phoenix team, admins, and anyone whose plan names no client. Worth a
            glance now and then for an account that should not be there.
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 xl:grid-cols-3">
            {live.unplaced.map((p) => (
              <li key={p.email} className="truncate">
                <span className="font-semibold">{p.name ?? p.email}</span>
                {p.name && <span className="text-mist"> · {p.email}</span>}
                {p.plan && <span className="block truncate text-[11px] text-mist/70">{p.plan}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ClientBlock({
  client,
  live,
  open,
  onToggle,
  onLink,
}: {
  client: Client;
  live: Live | null;
  open: boolean;
  onToggle: () => void;
  onLink: (key: LinkKey, value: string) => void;
}) {
  const people = client.members.filter(active);
  const found = live?.found[client.id] ?? {};
  // live word from the roster first; the stamp from an earlier check
  // when the roster could not be read today
  const inside = people.filter((m) => found[m.id] || (!live && m.communityJoinedAt));
  const outside = people.filter((m) => !inside.includes(m));
  const extra = live?.extra[client.id] ?? [];
  const missing = LINKS.filter((l) => !client[l.key]).length;

  return (
    <section className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/4"
      >
        <ChevronRight
          size={15}
          className={`shrink-0 text-mist transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{client.name}</span>
          <span className="block text-[11px] text-mist">
            {people.length === 0
              ? "No people on the list yet"
              : `${inside.length} of ${people.length} inside`}
            {extra.length ? ` · ${extra.length} inside but not on the list` : ""}
          </span>
        </span>
        {missing > 0 && (
          <span
            data-tip={`${missing} of the three links ${missing === 1 ? "is" : "are"} missing`}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ff7a55]"
          >
            <span aria-hidden className="size-2 rounded-full bg-[#ff7a55]" />
            {missing} missing
          </span>
        )}
        {people.length > 0 && (
          <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white/10 sm:block">
            <span
              className="block h-full rounded-full bg-[#4ade80]"
              style={{ width: `${(inside.length / people.length) * 100}%` }}
            />
          </span>
        )}
        <Link
          href={`/clients/${client.id}`}
          onClick={(e) => e.stopPropagation()}
          data-tip="Open this client"
          className="text-mist hover:text-paper"
        >
          <ExternalLink size={14} />
        </Link>
      </button>

      {open && (
        <div className="border-t border-white/8 px-5 py-4">
          {/* the three links, red where empty */}
          <div className="flex flex-col gap-2">
            {LINKS.map((l) => {
              const value = client[l.key] ?? "";
              return (
                <div key={l.key} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: value ? "#4ade80" : "#ff7a55" }}
                  />
                  <span data-tip={l.tip} className="w-20 shrink-0 text-[11px] font-medium text-mist">
                    {l.label}
                  </span>
                  <EditableText
                    value={value}
                    placeholder={l.placeholder}
                    invalid={!value}
                    onCommit={(v) => onLink(l.key, v.trim())}
                    className="text-xs text-mist"
                  />
                  {value && (
                    <>
                      <a
                        data-tip="Open in Mighty Networks"
                        href={value}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-mist hover:text-paper"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <button
                        data-tip="Copy"
                        onClick={() => navigator.clipboard?.writeText(value)}
                        className="shrink-0 cursor-pointer text-mist hover:text-paper"
                      >
                        <Copy size={12} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {people.length > 0 && (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <PeopleList
                title="Inside"
                count={inside.length}
                color="#4ade80"
                empty="Nobody from the list has joined yet."
                people={inside.map((m) => ({
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  note: found[m.id]?.joinedAt
                    ? `joined ${usDate(new Date(found[m.id].joinedAt!))}`
                    : m.communityJoinedAt
                      ? `joined ${usDate(new Date(m.communityJoinedAt))}`
                      : null,
                }))}
              />
              <PeopleList
                title="Not yet"
                count={outside.length}
                color="#facc15"
                empty="Everyone on the list is inside."
                people={outside.map((m) => ({
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  note: m.communityInvitedAt
                    ? `invited ${usDate(new Date(m.communityInvitedAt))}`
                    : "not invited yet",
                }))}
              />
            </div>
          )}

          {extra.length > 0 && (
            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-xs font-bold">
                <TriangleAlert size={13} className="text-[#ff7a55]" />
                Inside on this client's plan, but not on the list
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-mist">
                  {extra.length}
                </span>
              </h3>
              <p className="mt-1 text-[11px] text-mist">
                Either they joined with another address than the one on the list, or
                they should not be in there. Add them to the list or ask.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {extra.map((p) => (
                  <li key={p.email} className="truncate">
                    <span className="font-semibold">{p.name ?? p.email}</span>
                    {p.name && <span className="text-mist"> · {p.email}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PeopleList({
  title,
  count,
  color,
  empty,
  people,
}: {
  title: string;
  count: number;
  color: string;
  empty: string;
  people: Array<{ id: string; name: string; email: string; note: string | null }>;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-xs font-bold">
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {title}
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-mist">
          {count}
        </span>
      </h3>
      {people.length === 0 ? (
        <p className="mt-2 text-[11px] text-mist">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {people
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => (
              <li key={p.id} className="flex items-baseline gap-2">
                <Link href={`/members/${p.id}`} className="font-semibold hover:underline">
                  {p.name}
                </Link>
                <span className="min-w-0 truncate text-[11px] text-mist">{p.email}</span>
                {p.note && (
                  <span className="ml-auto shrink-0 text-[11px] text-mist/70">{p.note}</span>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
