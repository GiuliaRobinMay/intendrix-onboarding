"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Layers, Users } from "lucide-react";
import { PageHeader, Chip, StatCard, ProgressBar, GradientButton } from "@/components/ui";
import { NewCampaignForm } from "@/components/campaign-form";
import { useData } from "@/lib/state";
import {
  findTemplate,
  seriesProgress,
  campaignCompletion,
  triggerSession,
  fmtDate,
} from "@/lib/store";

export default function CampaignsPage() {
  const { clients, templates } = useData();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const today = new Date();

  const rows = clients.flatMap((client) =>
    client.campaigns.map((campaign) => ({ client, campaign }))
  );

  const totalSessions = rows.reduce((n, r) => n + r.campaign.sessions.length, 0);
  const scheduledSessions = rows.reduce(
    (n, r) => n + r.campaign.sessions.filter((s) => s.date).length,
    0
  );

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Every campaign across all clients. A client can run as many campaigns as they need."
        action={
          clients.length > 0 && (
            <GradientButton onClick={() => setCreatingFor(clients[0].id)}>
              + New campaign
            </GradientButton>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard accent label="Campaigns" value={rows.length} hint="across all clients" />
        <StatCard
          label="Clients running"
          value={new Set(rows.map((r) => r.client.id)).size}
          hint={`of ${clients.length} total`}
        />
        <StatCard
          label="Sessions"
          value={totalSessions}
          hint={`${scheduledSessions} with a date set`}
        />
        <StatCard
          label="Series loaded"
          value={rows.reduce((n, r) => n + r.campaign.series.length, 0)}
          hint="series across campaigns"
        />
      </div>

      {creatingFor && (
        <div className="mb-6">
          <div className="card mb-3 flex flex-wrap items-center gap-3 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-mist">
              Client
            </span>
            <select
              value={creatingFor}
              onChange={(e) => setCreatingFor(e.target.value)}
              className="rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <NewCampaignForm clientId={creatingFor} onClose={() => setCreatingFor(null)} />
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {rows.map(({ client, campaign }) => {
          const completion = campaignCompletion(campaign, templates, today);
          const nextSession = campaign.sessions
            .filter((s) => s.date && new Date(`${s.date}T00:00:00`) >= today)
            .sort((a, b) => a.date!.localeCompare(b.date!))[0];
          return (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}`}
              className="card card-hover block p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{campaign.name}</h2>
                  <p className="mt-0.5 truncate text-xs text-mist">{client.name}</p>
                </div>
                <Chip color="#a3a4f0">{campaign.code}</Chip>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-mist">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={12} />
                  {campaign.sessions.length} session
                  {campaign.sessions.length === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers size={12} />
                  {campaign.series.length} series
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={12} />
                  {client.members.length} members
                </span>
              </div>

              <div className="mt-4">
                <ProgressBar pct={completion.pct} />
                <p className="mt-1.5 text-[11px] text-mist">
                  {completion.sent} of {completion.total} lessons sent
                  {nextSession
                    ? ` · next session ${fmtDate(new Date(`${nextSession.date}T00:00:00`))}`
                    : " · no upcoming session date"}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {campaign.series.map((loaded) => {
                  const series = findTemplate(templates, loaded.templateId);
                  if (!series) return null;
                  const p = seriesProgress(campaign, loaded, series, today);
                  const bound = triggerSession(campaign, loaded);
                  return (
                    <Chip key={loaded.templateId} color={p.scheduled ? series.color : undefined}>
                      {series.code}{" "}
                      {p.scheduled
                        ? `${p.sent}/${p.total}`
                        : bound
                          ? "· no date"
                          : "· unbound"}
                    </Chip>
                  );
                })}
                {campaign.series.length === 0 && (
                  <span className="text-[11px] text-mist/70">No series loaded yet</span>
                )}
              </div>
            </Link>
          );
        })}

        {rows.length === 0 && (
          <div className="card p-10 text-center text-sm text-mist md:col-span-2">
            No campaigns yet.{" "}
            {clients.length > 0 ? (
              <button
                onClick={() => setCreatingFor(clients[0].id)}
                className="cursor-pointer font-semibold text-paper underline"
              >
                Create the first one
              </button>
            ) : (
              <Link href="/clients" className="font-semibold text-paper underline">
                Add a client first
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
