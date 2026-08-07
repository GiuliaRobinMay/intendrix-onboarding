"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  CircleCheck,
  CircleDashed,
  Layers,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  PageHeader,
  StatusChip,
  Chip,
  ProgressBar,
  GradientButton,
  GhostButton,
} from "@/components/ui";
import { Field } from "@/components/editable";
import { NewCampaignForm } from "@/components/campaign-form";
import { useData } from "@/lib/state";
import { findTemplate, campaignCompletion, seriesProgress, fmtDate } from "@/lib/store";
import type { MemberRole } from "@/lib/types";

function AddMemberForm({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { dispatch } = useData();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("participant");

  return (
    <div className="mb-4 rounded-xl border border-white/10 p-4">
      <div className="grid gap-3">
        <Field label="Name" value={name} onChange={setName} placeholder="Full name" />
        <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. COO" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="name@org.com" type="email" />
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
            Series
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
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
            <StatusChip status={client.status} />
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
        <section className="card p-6 xl:col-span-2">
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
                  <Link href={`/campaigns/${campaign.id}`} className="block p-4">
                    <div className="flex items-center justify-between gap-3 pr-8">
                      <p className="min-w-0 truncate text-sm font-bold">
                        {campaign.name}
                      </p>
                      <Chip color="#a3a4f0">{campaign.code}</Chip>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-mist">
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
                    title="Delete this campaign"
                    onClick={() =>
                      dispatch({
                        type: "removeCampaign",
                        clientId: client.id,
                        campaignId: campaign.id,
                      })
                    }
                    className="absolute right-3 top-3 hidden cursor-pointer rounded-lg p-1 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:block"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => setAddingCampaign(true)}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-6 text-sm font-semibold text-mist/60 transition-colors hover:border-white/25 hover:text-paper"
            >
              <Plus size={15} />
              {client.campaigns.length === 0
                ? "Create the first campaign for this client"
                : "Add another campaign"}
            </button>
          </div>
        </section>

        {/* Members */}
        <section className="card self-start p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Members</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-mist">
                {client.members.length}
              </span>
              <button
                onClick={() => setAddingMember(true)}
                className="cursor-pointer rounded-lg border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
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
                className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/4"
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    m.role === "leader" ? "brand-gradient" : "bg-white/8 text-mist"
                  }`}
                >
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
                      <Crown size={12} className="shrink-0 text-[#ff7a55]" />
                    )}
                  </p>
                  <p className="truncate text-[11px] text-mist">{m.title}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-mist/70 group-hover:hidden">
                  {m.role === "leader"
                    ? "Leader series"
                    : m.role === "coach"
                      ? "Coach"
                      : "Participant"}
                </span>
                <button
                  onClick={() =>
                    dispatch({ type: "removeMember", clientId: client.id, memberId: m.id })
                  }
                  className="hidden shrink-0 cursor-pointer rounded-lg p-1 text-mist hover:bg-white/10 hover:text-paper group-hover:block"
                >
                  <X size={13} />
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
    </>
  );
}
