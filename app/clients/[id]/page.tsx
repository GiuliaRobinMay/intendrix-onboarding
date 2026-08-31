"use client";

import Link from "next/link";
import { useState } from "react";
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
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
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
import { findTemplate, campaignCompletion, seriesProgress, fmtDate } from "@/lib/store";
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
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("participant");

  return (
    <div className="mb-4 rounded-md border border-white/10 p-4">
      <div className="grid gap-3">
        <Field label="Name" value={name} onChange={setName} placeholder="Full name" />
        <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. COO" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="name@org.com" type="email" />
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
            if (!name.trim()) return;
            dispatch({ type: "addMember", clientId, name: name.trim(), title, email, role });
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
        subtitle={`${client.sector} · ${client.location}`}
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Members</h2>
            <div className="flex items-center gap-2">
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
            {client.members.map((m) => (
              <li
                key={m.id}
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/4"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold text-mist">
                  {m.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {m.name}
                    {m.role === "leader" && (
                      <span data-tip="Receives the Leader series, with the Leaders Guides">
                        <Crown size={12} className="shrink-0 text-[#ff7a55]" />
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-mist">{m.title}</p>
                </div>
                <span className="shrink-0 text-[10px] font-medium text-mist/70 group-hover:hidden">
                  {m.role === "leader"
                    ? "Leader series"
                    : m.role === "coach"
                      ? "Coach"
                      : "Participant"}
                </span>
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
                  className="hidden shrink-0 cursor-pointer rounded-md p-1 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:block"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
            {client.members.length === 0 && (
              <li className="py-4 text-sm text-mist">
                No members yet — add the team with the + button.
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
