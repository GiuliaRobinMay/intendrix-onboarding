"use client";

// Every client's corner of the community, as a table.
//
// One row per client: how many of their people are inside, and the
// three links — space, plan, invitation — each a link symbol you can
// click, red where it is still missing. Open a row and the links are
// there to edit, and under them the client's people the way the client
// page shows them: a face, a name, an address, and the two small
// onboarding marks — blue once they are inside.
//
// "Inside" is read from the community itself: the people on this
// client's plan, hosts left out. The plan is found from the client's
// name when its link is not filled in yet, and offered to save.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Crown,
  ExternalLink,
  Link2,
  Plus,
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

interface ClientLive {
  plan: { id: string; name: string; url: string; guessed: boolean } | null;
  reason?: string;
  inside: Record<string, { joinedAt: string | null; email: string }>;
  extra: Array<{ name: string | null; email: string; joinedAt: string | null }>;
}

interface NewSpace {
  id: string;
  name: string;
  url: string;
  plan: { id: string; name: string; url: string } | null;
}

interface Live {
  at: string;
  clients: Record<string, ClientLive>;
  spaces: NewSpace[];
  spacesReason?: string;
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
const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export default function CommunityPage() {
  const { clients, dispatch } = useData();
  const router = useRouter();
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

  // the stamping pass: writes "joined" on every member the community
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

  const setLink = (clientId: string, key: LinkKey, value: string) =>
    dispatch({ type: "updateClient", clientId, patch: { [key]: value } });

  return (
    <>
      <PageHeader
        title="Intendrix Hub"
        subtitle="Every client space in the community, its links, and who of their people is inside. New clients start here."
        action={
          <span className="flex items-center gap-2">
            <GhostButton onClick={load} tip="Read the community again — new spaces, new members">
              <span className="flex items-center gap-1.5">
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                Refresh
              </span>
            </GhostButton>
            <GhostButton
              onClick={check}
              tip="Read the community again and mark everyone it has as joined"
            >
              <span className="flex items-center gap-1.5">
                <Check size={13} />
                {checking ? "Checking…" : "Check who joined"}
              </span>
            </GhostButton>
          </span>
        }
      />

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
              Read from the community just now
            </>
          ) : (
            <>
              <TriangleAlert size={13} className="text-[#ff7a55]" />
              {reason} — showing the last check
            </>
          )}
        </p>
      </div>

      {live && (live.spaces.length > 0 || live.spacesReason) && (
        <section className="card mb-4 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Plus size={14} className="text-[#4ade80]" />
            In the community, not here yet
            {live.spaces.length > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-mist">
                {live.spaces.length}
              </span>
            )}
          </h2>
          {live.spacesReason ? (
            <p className="mt-1 text-[11px] text-mist">{live.spacesReason}</p>
          ) : (
            <>
              <p className="mt-1 text-[11px] text-mist">
                Client spaces under TEAM CONNECT that no client here points at. Create the
                client from the space and its links come along.
              </p>
              <ul className="mt-3 divide-y divide-white/5">
                {live.spaces.map((sp) => (
                  <li key={sp.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{sp.name}</span>
                      <span className="block truncate text-[11px] text-mist">
                        {sp.plan ? `plan: ${sp.plan.name}` : "no plan with this name yet"}
                      </span>
                    </span>
                    <a
                      href={sp.url}
                      target="_blank"
                      rel="noreferrer"
                      data-tip="Open the space"
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#6ea8ff] hover:underline"
                    >
                      <Link2 size={13} /> space
                    </a>
                    {sp.plan && (
                      <a
                        href={sp.plan.url}
                        target="_blank"
                        rel="noreferrer"
                        data-tip="Open the plan"
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#6ea8ff] hover:underline"
                      >
                        <Link2 size={13} /> plan
                      </a>
                    )}
                    <button
                      data-tip="Create this client here, with the space and plan links filled in — the checklist on the client page says what comes next"
                      onClick={() => {
                        const id = crypto.randomUUID();
                        dispatch({ type: "addClient", id, name: sp.name, location: "", sector: "" });
                        dispatch({
                          type: "updateClient",
                          clientId: id,
                          patch: {
                            spaceUrl: sp.url,
                            ...(sp.plan ? { planUrl: sp.plan.url } : {}),
                          },
                        });
                        router.push(`/clients/${id}`);
                      }}
                      className="brand-gradient cursor-pointer rounded-md px-3 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-90"
                    >
                      + Create client
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/8 text-[11px] font-semibold text-mist">
              <th className="w-8 px-3 py-2.5" />
              <th className="px-2 py-2.5 font-semibold">Client</th>
              <th className="px-3 py-2.5 font-semibold">Inside</th>
              <th className="px-3 py-2.5 font-semibold">Space</th>
              <th className="px-3 py-2.5 font-semibold">Plan</th>
              <th className="px-3 py-2.5 font-semibold">Invitation</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((client) => (
              <ClientRows
                key={client.id}
                client={client}
                live={live?.clients[client.id] ?? null}
                connected={Boolean(live)}
                open={open.has(client.id) || Boolean(q)}
                onToggle={() => toggle(client.id)}
                onLink={(key, value) => setLink(client.id, key, value)}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-mist">
                  No client matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** One client: the summary row, and the opened detail under it. */
function ClientRows({
  client,
  live,
  connected,
  open,
  onToggle,
  onLink,
}: {
  client: Client;
  live: ClientLive | null;
  connected: boolean;
  open: boolean;
  onToggle: () => void;
  onLink: (key: LinkKey, value: string) => void;
}) {
  const people = client.members.filter(active).sort((a, b) => a.name.localeCompare(b.name));
  const inside = live?.inside ?? {};
  // the community's word when it could be read; the stamp from the last
  // check when it could not
  const isInside = (m: Member) => (connected ? Boolean(inside[m.id]) : Boolean(m.communityJoinedAt));
  const insideCount = people.filter(isInside).length;
  const extra = live?.extra ?? [];
  const plan = live?.plan ?? null;
  // offered, never written by itself: the plan found from the client's name
  const offer = plan && plan.guessed && !client.planUrl ? plan : null;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-white/4"
      >
        <td className="px-3 py-3">
          <ChevronRight
            size={14}
            className={`text-mist transition-transform ${open ? "rotate-90" : ""}`}
          />
        </td>
        <td className="px-2 py-3">
          <span className="block text-sm font-bold">{client.name}</span>
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          {people.length === 0 ? (
            <span className="text-mist">no members yet</span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="font-semibold">
                {insideCount} of {people.length}
              </span>
              <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-white/10 lg:block">
                <span
                  className="block h-full rounded-full bg-[#6ea8ff]"
                  style={{ width: `${(insideCount / people.length) * 100}%` }}
                />
              </span>
              {extra.length > 0 && (
                <span
                  data-tip={`${extra.length} inside on this client's plan but not on the list — open the row`}
                  className="text-[11px] font-semibold text-[#facc15]"
                >
                  +{extra.length}
                </span>
              )}
            </span>
          )}
        </td>
        {LINKS.map((l) => (
          <td key={l.key} className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
            <LinkCell value={client[l.key] ?? ""} label={l.label} />
          </td>
        ))}
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/clients/${client.id}`}
            data-tip="Open this client"
            className="text-mist hover:text-paper"
          >
            <ExternalLink size={14} />
          </Link>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={7} className="bg-white/2 px-5 py-4">
            {/* the three links, to edit */}
            <div className="flex flex-col gap-2">
              {LINKS.map((l) => {
                const value = client[l.key] ?? "";
                return (
                  <div key={l.key} className="flex items-center gap-2.5">
                    <Link2
                      size={13}
                      className="shrink-0"
                      style={{ color: value ? "#4ade80" : "#ff7a55" }}
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
                    {l.key === "planUrl" && offer && (
                      <button
                        data-tip={`The community has a plan named "${offer.name}" — save its link here`}
                        onClick={() => onLink("planUrl", offer.url)}
                        className="shrink-0 cursor-pointer rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
                      >
                        Use “{offer.name}”
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {plan && live?.reason && (
              <p className="mt-3 text-[11px] text-mist">{live.reason}</p>
            )}

            {/* the members, the way the client page shows them */}
            {people.length === 0 && extra.length === 0 ? (
              <p className="mt-4 text-[11px] text-mist">No members yet.</p>
            ) : (
              <div className="mt-4">
                {people.map((m) => {
                  const hit = inside[m.id];
                  // the date they came in, in the community's blue; the
                  // rest say where they stand, in yellow or grey
                  const when = hit?.joinedAt ?? m.communityJoinedAt ?? null;
                  const state = isInside(m)
                    ? { text: when ? usDate(new Date(when)) : "inside", color: "#6ea8ff" }
                    : m.communityInvitedAt
                      ? { text: `invited ${usDate(new Date(m.communityInvitedAt))}`, color: "#facc15" }
                      : { text: "not invited", color: "#5a5c6b" };
                  return (
                    <PersonRow
                      key={m.id}
                      name={m.name}
                      email={m.email}
                      href={`/members/${m.id}`}
                      leader={m.role === "leader"}
                      state={state}
                      sub={hit && hit.email && hit.email !== m.email.toLowerCase() ? `joined as ${hit.email}` : null}
                    />
                  );
                })}
                {extra.map((p) => (
                  <PersonRow
                    key={p.email || p.name || Math.random()}
                    name={p.name ?? p.email}
                    email={p.email}
                    leader={false}
                    tag="NOT ON THE LIST"
                    state={{
                      text: p.joinedAt ? usDate(new Date(p.joinedAt)) : "inside",
                      color: "#6ea8ff",
                    }}
                    sub={null}
                  />
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** A link in a table cell: the symbol, clickable, or a red dot. */
function LinkCell({ value, label }: { value: string; label: string }) {
  if (!value)
    return (
      <span
        data-tip={`No ${label.toLowerCase()} link yet — open the row to paste it`}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ff7a55]"
      >
        <span aria-hidden className="size-2 rounded-full bg-[#ff7a55]" />
        missing
      </span>
    );
  return (
    <span className="flex items-center gap-2">
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        data-tip={value}
        className="flex items-center gap-1 text-[11px] font-semibold text-[#6ea8ff] hover:underline"
      >
        <Link2 size={13} /> open
      </a>
      <button
        data-tip="Copy"
        onClick={() => navigator.clipboard?.writeText(value)}
        className="cursor-pointer text-mist hover:text-paper"
      >
        <Copy size={12} />
      </button>
    </span>
  );
}

function PersonRow({
  name,
  email,
  href,
  leader,
  tag,
  state,
  sub,
}: {
  name: string;
  email: string;
  href?: string;
  leader: boolean;
  /** a word on the row that is not like the others */
  tag?: string;
  /** where they stand, in the colour that says so */
  state: { text: string; color: string };
  sub: string | null;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_auto] items-center gap-x-3 border-b border-white/5 px-1 py-1.5 transition-colors hover:bg-white/4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold text-mist">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {href ? (
              <Link href={href} className="truncate hover:underline">
                {name}
              </Link>
            ) : (
              <span className="truncate">{name}</span>
            )}
            {leader && (
              <span data-tip="Receives the Leader series, with the Leaders Guides" className="shrink-0">
                <Crown size={11} className="text-[#ff7a55]" />
              </span>
            )}
          </p>
          {sub && <p className="truncate text-[11px] text-mist">{sub}</p>}
        </div>
      </div>
      <span className="min-w-0 truncate text-xs text-mist">{email || "no email"}</span>
      <span className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold">
        {tag && (
          <span
            data-tip="On this client's plan in the community, but not on the client's list here — add them, or ask who they are"
            className="rounded bg-[#facc15]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#facc15]"
          >
            {tag}
          </span>
        )}
        <span style={{ color: state.color }}>{state.text}</span>
      </span>
    </div>
  );
}
