"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  Copy,
  Crown,
  ExternalLink,
  CircleCheck,
  CircleDashed,
  Info,
  Layers,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { US_STATES, stateByCode } from "@/lib/us-states";
import { authHeaders } from "@/lib/supabase-browser";

/** what the send log + the provider say about one email to one person */
const HISTORY_LABEL: Record<string, { text: string; color: string }> = {
  clicked: { text: "clicked", color: "var(--tone-green)" },
  opened: { text: "opened", color: "var(--tone-green)" },
  delivered: { text: "delivered", color: "var(--color-mist)" },
  delivery_delayed: { text: "delayed", color: "var(--tone-yellow)" },
  bounced: { text: "bounced", color: "#ff7a55" },
  complained: { text: "marked as spam", color: "#ff7a55" },
  failed: { text: "failed", color: "#ff7a55" },
  held: { text: "held", color: "var(--tone-yellow)" },
  sent: { text: "sent", color: "var(--color-mist)" },
};

/** Every email one person was sent, newest first — the individual-level
 *  answer to "did they get it?". Loaded when the info panel opens. */
function MemberHistory({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<Array<{
    title: string;
    campaign: string;
    status: string;
    error: string | null;
    event: string | null;
    at: string | null;
  }> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/member-history?memberId=${encodeURIComponent(memberId)}`,
          { headers: await authHeaders() }
        );
        const out = await res.json();
        if (cancelled) return;
        if (out.rows) setRows(out.rows);
        else setErr(out.error ?? "could not load the history");
      } catch {
        if (!cancelled) setErr("could not reach the server");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  if (err) return <p className="text-[11px] font-semibold text-[#ff7a55]">{err}</p>;
  if (!rows) return <p className="text-[11px] text-mist">Loading…</p>;
  if (rows.length === 0)
    return <p className="text-[11px] text-mist">No emails yet.</p>;
  return (
    <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto pr-1">
      {rows.map((r, i) => {
        const label =
          r.status === "sent"
            ? HISTORY_LABEL[r.event ?? "sent"] ?? HISTORY_LABEL.sent
            : HISTORY_LABEL[r.status] ?? { text: r.status, color: "#ff7a55" };
        return (
          <li key={i} className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="min-w-0 truncate text-paper/90">
              {r.title}
              <span className="ml-1.5 text-mist/60">{r.campaign}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              {r.at && (
                <span className="tabular-nums text-mist/70">
                  {fmtDate(new Date(r.at))}
                </span>
              )}
              <span
                className="font-semibold"
                style={{ color: label.color }}
                title={r.error ?? undefined}
              >
                {label.text}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
import {
  PageHeader,
  Chip,
  ProgressBar,
  GradientButton,
  GhostButton,
} from "@/components/ui";
import { EditableText, Field } from "@/components/editable";
import { NewCampaignForm } from "@/components/campaign-form";
import { useData } from "@/lib/state";
import { useConfirm } from "@/components/confirm";
import { findTemplate, campaignCompletion, seriesProgress, fmtDate, fmtSendTime } from "@/lib/store";
import type { Client, ClientStatus, MemberRole } from "@/lib/types";

/** The three Phoenix roles at client level — one person each. */
const ROLE_FIELDS = [
  { field: "phoenixLeaderId", label: "Phoenix Leader" },
  { field: "phoenixCoachId", label: "Phoenix Coach" },
  { field: "projectManagerId", label: "Project Manager" },
] as const;
type RoleField = (typeof ROLE_FIELDS)[number]["field"];

const selectCls =
  "w-full min-w-0 cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none";

/** Phoenix responsibles as a small name + role table, rows added with +. */
function ResponsiblesCard({ client }: { client: Client }) {
  const { staff: team, dispatch } = useData();
  const confirmDelete = useConfirm();
  const [adding, setAdding] = useState(false);
  const [staffId, setStaffId] = useState(team[0]?.id ?? "");
  const [role, setRole] = useState<RoleField>("phoenixLeaderId");

  const assigned = ROLE_FIELDS.filter((r) => client[r.field]);
  const free = ROLE_FIELDS.filter((r) => !client[r.field]);

  const patchRoles = (patch: Partial<Record<RoleField, string | undefined>>) =>
    dispatch({ type: "updateClient", clientId: client.id, patch });

  const openAdd = () => {
    setStaffId(team[0]?.id ?? "");
    setRole(free[0].field);
    setAdding(true);
  };

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-bold">Phoenix responsibles</h2>
        {free.length > 0 && (
          <button
            data-tip="Add a responsible"
            onClick={openAdd}
            className="cursor-pointer rounded-md border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-mist">Who at Phoenix owns this organization.</p>

      {assigned.length > 0 && (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.5rem] items-center gap-x-2 border-b border-white/8 pb-1.5 text-[11px] font-medium text-mist">
            <span>Name</span>
            <span>Role</span>
            <span />
          </div>
          {assigned.map((r) => (
            <div
              key={r.field}
              className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.5rem] items-center gap-x-2 border-b border-white/5 py-2 last:border-b-0"
            >
              <select
                title="Who at Phoenix holds this role"
                value={client[r.field] ?? ""}
                onChange={(e) => patchRoles({ [r.field]: e.target.value })}
                className={selectCls}
              >
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                title="Their role for this organization"
                value={r.field}
                onChange={(e) => {
                  const next = e.target.value as RoleField;
                  if (next !== r.field)
                    patchRoles({ [r.field]: undefined, [next]: client[r.field] });
                }}
                className={selectCls}
              >
                <option value={r.field}>{r.label}</option>
                {free.map((f) => (
                  <option key={f.field} value={f.field}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                data-tip="Remove this responsible"
                onClick={async () => {
                  const person = team.find((t) => t.id === client[r.field]);
                  if (
                    await confirmDelete({
                      name: person?.name ?? r.label,
                      detail: `Removes them as ${r.label} for ${client.shortName} — they stay on the Phoenix team.`,
                      verb: "Remove",
                    })
                  )
                    patchRoles({ [r.field]: undefined });
                }}
                className="cursor-pointer justify-self-end rounded-md p-1 text-mist opacity-0 transition-opacity hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </>
      )}

      {assigned.length === 0 && !adding && (
        <p className="py-2 text-sm text-mist">
          No responsibles yet — add them with the + button.
        </p>
      )}

      {adding && (
        <div className="mt-3 rounded-md border border-white/10 p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              title="Who at Phoenix to add"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className={selectCls}
            >
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              title="Their role for this organization"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleField)}
              className={selectCls}
            >
              {free.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2.5 flex gap-2">
            <GradientButton
              onClick={() => {
                if (!staffId || !free.some((f) => f.field === role)) return;
                patchRoles({ [role]: staffId });
                setAdding(false);
              }}
            >
              Add
            </GradientButton>
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
          </div>
        </div>
      )}

      <p className="mt-3 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-mist">
        The Coach is the one emails are sent from. Campaigns can override each
        role on their own page.
      </p>
    </section>
  );
}

function AddMemberForm({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { dispatch } = useData();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("participant");

  return (
    <div className="mb-4 rounded-md border border-white/10 p-4">
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={firstName} onChange={setFirstName} placeholder="" />
          <Field label="Last name" value={lastName} onChange={setLastName} placeholder="" />
        </div>
        <Field label="Title" value={title} onChange={setTitle} placeholder="" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="" type="email" />
        <label className="block">
          <span className="text-[11px] font-medium text-mist">
            Series
          </span>
          <select
            title="Which series this member receives"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="mt-1 w-full rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-[13px] focus:border-white/30 focus:outline-none"
          >
            <option value="participant">Participant series</option>
            <option value="leader">Leader series (CEO)</option>
            <option value="coach">Coach (copy of every send)</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <GradientButton
          onClick={() => {
            const first = firstName.trim();
            const last = lastName.trim();
            if (!first && !last) return;
            dispatch({
              type: "addMember",
              clientId,
              name: [first, last].filter(Boolean).join(" "),
              firstName: first,
              lastName: last,
              title,
              email: email.trim(),
              role,
            });
            onClose();
          }}
        >
          Add member
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const confirmDelete = useConfirm();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { clients, templates, dispatch } = useData();
  const [addingMember, setAddingMember] = useState(false);
  const [openMemberInfo, setOpenMemberInfo] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [addingCampaign, setAddingCampaign] = useState(false);

  const client = clients.find((c) => c.id === id);
  const today = new Date();

  if (!client) {
    return (
      <div className="card p-10 text-center text-sm text-mist">
        Client not found.{" "}
        <Link href="/clients" className="font-semibold text-paper underline">
          Back to clients
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> All clients
      </Link>

      <PageHeader
        title={client.name}
        subtitle={`${client.sector} · ${
          client.city || client.state
            ? [client.city, stateByCode(client.state)?.name]
                .filter(Boolean)
                .join(", ")
            : client.location
        }`}
        action={
          <div className="flex items-center gap-3">
            <select
              data-tip="Onboarding, active, or archived. Archived clients drop out of the default lists but nothing is deleted."
              value={client.status}
              onChange={(e) =>
                dispatch({
                  type: "updateClient",
                  clientId: client.id,
                  patch: { status: e.target.value as ClientStatus },
                })
              }
              className="cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1 text-xs font-semibold text-paper focus:border-white/30 focus:outline-none"
            >
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <GradientButton onClick={() => setAddingCampaign(true)}>
              + New campaign
            </GradientButton>
          </div>
        }
      />

      {addingCampaign && (
        <NewCampaignForm clientId={client.id} onClose={() => setAddingCampaign(false)} />
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Campaigns */}
        <section className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Layers size={17} className="text-mist" /> Campaigns
              <span className="text-sm font-medium text-mist">
                ({client.campaigns.length})
              </span>
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {client.campaigns.map((campaign) => {
              const completion = campaignCompletion(campaign, templates, today);
              const nextSession = campaign.sessions
                .filter((s) => s.date && new Date(`${s.date}T00:00:00`) >= today)
                .sort((a, b) => a.date!.localeCompare(b.date!))[0];
              return (
                <div key={campaign.id} className="card group relative">
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    data-tip="Open this campaign"
                    data-tip-pos="bottom"
                    className="block p-4"
                  >
                    <div className="flex items-center justify-between gap-3 pr-8">
                      <p className="min-w-0 truncate text-sm font-bold">
                        {campaign.name}
                      </p>
                      <Chip color="#a3a4f0">{campaign.code}</Chip>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-mist">
                      <span
                        data-tip="When this campaign runs — set the dates on the campaign page"
                        className="flex items-center gap-1.5 font-semibold text-paper/90"
                      >
                        <CalendarRange size={12} />
                        {campaign.startDate || campaign.endDate
                          ? `${
                              campaign.startDate
                                ? fmtDate(new Date(`${campaign.startDate}T00:00:00`))
                                : "…"
                            } – ${
                              campaign.endDate
                                ? fmtDate(new Date(`${campaign.endDate}T00:00:00`))
                                : "…"
                            }`
                          : "No start & end date yet"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={12} />
                        {campaign.sessions.length} session
                        {campaign.sessions.length === 1 ? "" : "s"}
                        {nextSession
                          ? ` · next ${fmtDate(new Date(`${nextSession.date}T00:00:00`))}`
                          : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Layers size={12} />
                        {campaign.series.length} series
                      </span>
                    </p>
                    <div className="mt-3">
                      <ProgressBar pct={completion.pct} />
                      <p className="mt-1.5 text-[11px] text-mist">
                        {completion.sent} of {completion.total} lessons sent
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {campaign.series.map((loaded) => {
                        const series = findTemplate(templates, loaded.templateId);
                        if (!series) return null;
                        const p = seriesProgress(campaign, loaded, series, today);
                        return (
                          <Chip
                            key={loaded.templateId}
                            color={p.scheduled ? series.color : undefined}
                          >
                            {series.code} {p.scheduled ? `${p.sent}/${p.total}` : "· waiting"}
                          </Chip>
                        );
                      })}
                    </div>
                  </Link>
                  <button
                    data-tip="Delete this campaign and its schedule"
                    onClick={async () => {
                      if (
                        await confirmDelete({
                          name: campaign.name,
                          detail: "Deletes the campaign with its sessions and schedule, and everything already logged about its sends. The lesson library is untouched.",
                        })
                      )
                        dispatch({
                          type: "removeCampaign",
                          clientId: client.id,
                          campaignId: campaign.id,
                        });
                    }}
                    className="absolute right-3 top-3 hidden cursor-pointer rounded-md p-1 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:block"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => setAddingCampaign(true)}
              data-tip="Start a programme for this client — pick a blueprint and it arrives with its sessions and series"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-white/10 py-6 text-sm font-semibold text-mist/60 transition-colors hover:border-white/25 hover:text-paper"
            >
              <Plus size={15} />
              {client.campaigns.length === 0
                ? "Create the first campaign for this client"
                : "Add another campaign"}
            </button>
          </div>
        </section>

        {/* Right column */}
        <div className="flex flex-col gap-6">
        <ResponsiblesCard client={client} />

        {/* Where the client is — the state drives new campaigns' timezone */}
        <section className="card p-5">
          <h2 className="mb-1 text-base font-bold">Location</h2>
          <p className="mb-4 text-xs text-mist">
            The state decides which timezone new campaigns start with, so
            emails land at 8:00 AM in the client&rsquo;s own morning.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-14 shrink-0 text-[11px] font-medium text-mist">
                State
              </span>
              <select
                data-tip="The client's US state — new campaigns default to its timezone"
                value={client.state ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "updateClient",
                    clientId: client.id,
                    patch: { state: e.target.value },
                  })
                }
                className="min-w-0 flex-1 cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2 py-1.5 text-xs font-semibold focus:border-white/30 focus:outline-none"
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
              <span className="w-14 shrink-0 text-[11px] font-medium text-mist">
                City
              </span>
              <EditableText
                value={client.city ?? ""}
                placeholder="e.g. Ann Arbor"
                onCommit={(v) =>
                  dispatch({
                    type: "updateClient",
                    clientId: client.id,
                    patch: { city: v.trim() },
                  })
                }
                className="text-xs"
              />
            </div>
            {client.state ? (
              <p className="text-[11px] text-mist">
                New campaigns for this client start in{" "}
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
        </section>

        {/* Mighty Networks */}
        <section className="card p-5">
          <h2 className="mb-1 text-base font-bold">Mighty Networks</h2>
          <p className="mb-4 text-xs text-mist">
            This client&rsquo;s space and the invitation link members use to join.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-14 shrink-0 text-[11px] font-medium text-mist">
                Space
              </span>
              <EditableText
                value={client.spaceUrl ?? ""}
                placeholder="Paste the space URL…"
                onCommit={(v) =>
                  dispatch({
                    type: "updateClient",
                    clientId: client.id,
                    patch: { spaceUrl: v },
                  })
                }
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
              <span className="w-14 shrink-0 text-[11px] font-medium text-mist">
                Invite
              </span>
              <EditableText
                value={client.inviteUrl ?? ""}
                placeholder="Paste the plan invitation link…"
                onCommit={(v) =>
                  dispatch({
                    type: "updateClient",
                    clientId: client.id,
                    patch: { inviteUrl: v },
                  })
                }
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
          </div>
        </section>

        {/* Members */}
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold">Members</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={12}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-mist"
                />
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Search…"
                  title="Find a person by name, email or title"
                  className="w-32 rounded-md border border-white/10 bg-navy/60 py-1 pl-6.5 pr-2 text-xs focus:w-44 focus:border-white/30 focus:outline-none"
                />
              </div>
              <span className="text-xs font-semibold text-mist">
                {client.members.length}
              </span>
              <button
                data-tip="Add a member to this client"
                onClick={() => setAddingMember(true)}
                className="cursor-pointer rounded-md border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {addingMember && (
            <AddMemberForm clientId={client.id} onClose={() => setAddingMember(false)} />
          )}

          <ul className="flex max-h-130 flex-col gap-1 overflow-y-auto pr-1">
            {[...client.members]
              .sort((x, y) => x.name.localeCompare(y.name))
              .filter((m) =>
                memberQuery.trim()
                  ? `${m.name} ${m.email} ${m.title ?? ""}`
                      .toLowerCase()
                      .includes(memberQuery.trim().toLowerCase())
                  : true
              )
              .map((m) => (
              <li key={m.id} className="rounded-md transition-colors hover:bg-white/4">
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold text-mist">
                    {m.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-semibold">{m.name}</span>
                    {m.role === "leader" && (
                      <span
                        data-tip="Receives the Leader series, with the Leaders Guides"
                        className="ml-1.5 inline-flex align-baseline"
                      >
                        <Crown size={11} className="text-[#ff7a55]" />
                      </span>
                    )}
                    {m.title && (
                      <span className="ml-2 text-[11px] text-mist">{m.title}</span>
                    )}
                  </p>
                  <select
                    data-tip="Which series they receive — Leader gets the Leaders Guides, Coach gets a copy of every send"
                    value={m.role}
                    onChange={(e) =>
                      dispatch({
                        type: "updateMember",
                        clientId: client.id,
                        memberId: m.id,
                        patch: { role: e.target.value as MemberRole },
                      })
                    }
                    className="shrink-0 cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-[10px] font-medium text-mist/70 transition-colors hover:border-white/15 hover:bg-navy/60 focus:border-white/30 focus:outline-none"
                  >
                    <option value="participant">Participant</option>
                    <option value="leader">Leader series</option>
                    <option value="coach">Coach</option>
                  </select>
                  <button
                    data-tip="Email address and details — click to change them"
                    onClick={() =>
                      setOpenMemberInfo(openMemberInfo === m.id ? null : m.id)
                    }
                    className={`shrink-0 cursor-pointer rounded-md p-1 transition-colors ${
                      openMemberInfo === m.id
                        ? "bg-white/10 text-paper"
                        : "text-mist hover:bg-white/8 hover:text-paper"
                    }`}
                  >
                    <Info size={13} />
                  </button>
                  <button
                    data-tip="Remove this member"
                    onClick={async () => {
                      if (
                        await confirmDelete({
                          name: m.name,
                          detail: `They stop receiving emails from every ${client.shortName} campaign, from the next send on. What they already received stays in the log.`,
                          verb: "Remove",
                        })
                      )
                        dispatch({ type: "removeMember", clientId: client.id, memberId: m.id });
                    }}
                    className="shrink-0 cursor-pointer rounded-md p-1 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* the details behind the info button — where editing lives */}
                {openMemberInfo === m.id && (
                  <div className="mx-2 mb-2 grid gap-x-4 gap-y-2 rounded-md border border-white/8 bg-navy/40 px-3 py-2.5 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] font-medium text-mist">First name</span>
                      <EditableText
                        value={m.firstName ?? ""}
                        placeholder="First"
                        onCommit={(v) =>
                          dispatch({
                            type: "updateMember",
                            clientId: client.id,
                            memberId: m.id,
                            patch: { firstName: v.trim() },
                          })
                        }
                        className="text-xs font-semibold"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-mist">Last name</span>
                      <EditableText
                        value={m.lastName ?? ""}
                        placeholder="Last"
                        onCommit={(v) =>
                          dispatch({
                            type: "updateMember",
                            clientId: client.id,
                            memberId: m.id,
                            patch: { lastName: v.trim() },
                          })
                        }
                        className="text-xs font-semibold"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-mist">Title</span>
                      <EditableText
                        value={m.title ?? ""}
                        placeholder="Title"
                        onCommit={(v) =>
                          dispatch({
                            type: "updateMember",
                            clientId: client.id,
                            memberId: m.id,
                            patch: { title: v.trim() },
                          })
                        }
                        className="text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-mist">Email</span>
                      <EditableText
                        value={m.email}
                        placeholder="email@company.com"
                        onCommit={(v) =>
                          v.includes("@") &&
                          dispatch({
                            type: "updateMember",
                            clientId: client.id,
                            memberId: m.id,
                            patch: { email: v.trim() },
                          })
                        }
                        className="text-xs"
                      />
                    </label>
                    <div className="border-t border-white/8 pt-2 sm:col-span-2">
                      <p className="mb-1 text-[10px] font-medium text-mist">
                        Emails received
                      </p>
                      <MemberHistory memberId={m.id} />
                    </div>
                  </div>
                )}
              </li>
            ))}
            {client.members.length === 0 && (
              <li className="py-4 text-sm text-mist">
                No members yet — add the team with the + button.
              </li>
            )}
            {client.members.length > 0 &&
              memberQuery.trim() !== "" &&
              !client.members.some((m) =>
                `${m.name} ${m.email} ${m.title ?? ""}`
                  .toLowerCase()
                  .includes(memberQuery.trim().toLowerCase())
              ) && (
                <li className="py-4 text-sm text-mist">
                  Nobody matches &ldquo;{memberQuery.trim()}&rdquo;.{" "}
                  <button
                    onClick={() => setMemberQuery("")}
                    className="cursor-pointer font-semibold underline hover:text-paper"
                  >
                    Clear the search
                  </button>
                </li>
              )}
          </ul>
          <div className="mt-4 border-t border-white/5 pt-4 text-xs leading-relaxed text-mist">
            <p className="flex items-center gap-1.5">
              <CircleCheck size={13} className="text-[#4ade80]" />
              Leader receives the Leader series (with Leaders Guides).
            </p>
            <p className="mt-1.5 flex items-center gap-1.5">
              <CircleDashed size={13} />
              Coaches receive a copy of every send.
            </p>
          </div>
        </section>
        </div>
      </div>

      {/* The one door out for a whole organization — deliberately quiet
          and at the very bottom, behind the same are-you-sure dialog. */}
      <div className="mt-8 border-t border-white/5 pt-4 text-right">
        <button
          data-tip="Deletes the whole organization — usually Archived (top of the page) is the better choice"
          onClick={async () => {
            if (
              await confirmDelete({
                name: client.name,
                detail: `Deletes the organization with all ${client.members.length} members, every campaign, and its full send history. Archiving keeps everything — deleting cannot be undone.`,
              })
            ) {
              dispatch({ type: "removeClient", clientId: client.id });
              router.push("/clients");
            }
          }}
          className="cursor-pointer text-[11px] font-semibold text-mist/50 underline transition-colors hover:text-[#ff7a55]"
        >
          Delete this client…
        </button>
      </div>
    </>
  );
}
