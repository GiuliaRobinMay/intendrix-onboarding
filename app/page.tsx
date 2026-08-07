"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, Mail, ArrowRight } from "lucide-react";
import { PageHeader, StatCard, Chip, StatusChip, ProgressBar, GradientButton } from "@/components/ui";
import { useData } from "@/lib/state";
import {
  dashboardStats,
  upcomingSends,
  findTemplate,
  campaignCompletion,
  seriesProgress,
  triggerSession,
  fmtDate,
  fmtDateShort,
  fmtWeekday,
} from "@/lib/store";

export default function DashboardPage() {
  const { clients, templates } = useData();
  const router = useRouter();
  const today = new Date();
  const stats = dashboardStats(clients, templates, today);
  const sends = upcomingSends(clients, templates, today).slice(0, 6);

  const campaignRows = clients.flatMap((client) =>
    client.campaigns.map((campaign) => ({ client, campaign }))
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Today is ${fmtDate(today)} — here's what's moving.`}
        action={
          <GradientButton onClick={() => router.push("/clients?new=1")}>
            + New client
          </GradientButton>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          accent
          label="Active clients"
          value={stats.activeClients}
          hint={
            stats.onboardingClients
              ? `${stats.onboardingClients} more onboarding`
              : "all live"
          }
        />
        <StatCard
          label="Campaigns"
          value={stats.campaigns}
          hint={`${stats.membersEnrolled} members enrolled`}
        />
        <StatCard label="Sends · next 30 days" value={stats.scheduledNext30} hint="emails scheduled" />
        <StatCard
          label="Module library"
          value={stats.seriesInLibrary}
          hint={`${stats.totalLessons} lessons in ${stats.seriesInLibrary} series`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {/* Upcoming sends */}
        <section className="card p-6 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Mail size={17} className="text-mist" /> Upcoming sends
            </h2>
            <Link
              href="/progress"
              className="flex items-center gap-1 text-xs font-semibold text-mist transition-colors hover:text-paper"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <ul className="divide-y divide-white/5">
            {sends.map((s) => (
              <li key={`${s.campaign.id}-${s.step.id}`} className="flex items-center gap-4 py-3">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-[10px] font-bold uppercase text-mist">
                    {fmtWeekday(s.date!)}
                  </p>
                  <p className="text-sm font-bold tabular-nums">{fmtDateShort(s.date!)}</p>
                </div>
                <div
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: s.series.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {s.step.code} · {s.step.title}
                  </p>
                  <p className="truncate text-xs text-mist">
                    {s.client.shortName} · {s.campaign.code} · {s.step.sendTime} ·
                    Participant + Leader
                  </p>
                </div>
                <Chip color={s.series.color}>{s.series.code}</Chip>
              </li>
            ))}
            {sends.length === 0 && (
              <li className="py-6 text-sm text-mist">No sends scheduled yet.</li>
            )}
          </ul>
        </section>

        {/* Campaigns overview */}
        <section className="card p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Megaphone size={17} className="text-mist" /> Campaigns
            </h2>
            <Link
              href="/campaigns"
              className="flex items-center gap-1 text-xs font-semibold text-mist transition-colors hover:text-paper"
            >
              All campaigns <ArrowRight size={13} />
            </Link>
          </div>

          <div className="flex flex-col gap-5">
            {campaignRows.map(({ client, campaign }) => {
              const completion = campaignCompletion(campaign, templates, today);
              return (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="card card-hover block p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-bold">{campaign.name}</p>
                    <StatusChip status={client.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-mist">
                    {client.name} · {campaign.sessions.length} sessions ·{" "}
                    {client.members.length} members
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
                      const bound = triggerSession(campaign, loaded);
                      return (
                        <Chip
                          key={loaded.templateId}
                          color={p.scheduled ? series.color : undefined}
                        >
                          {series.code}{" "}
                          {p.scheduled
                            ? `${p.sent}/${p.total}`
                            : bound
                              ? "· no date"
                              : "· unbound"}
                        </Chip>
                      );
                    })}
                  </div>
                </Link>
              );
            })}
            {campaignRows.length === 0 && (
              <p className="text-sm text-mist">No campaigns yet.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
