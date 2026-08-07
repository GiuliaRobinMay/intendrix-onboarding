// Pure scheduling/statistics helpers. State lives in lib/state.tsx (the
// interactive prototype store); in the Supabase phase these same functions
// run against rows from the database.

import type {
  Campaign,
  Client,
  LoadedSeries,
  ScheduledStep,
  SeriesTemplate,
} from "./types";

// ——— dates ————————————————————————————————————————————————

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtWeekday(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// ——— lookups ———————————————————————————————————————————————

export function findTemplate(
  templates: SeriesTemplate[],
  id: string
): SeriesTemplate | undefined {
  return templates.find((t) => t.id === id);
}

/** Locate a campaign (and its client) by campaign id. */
export function findCampaign(
  clients: Client[],
  campaignId: string
): { client: Client; campaign: Campaign } | undefined {
  for (const client of clients) {
    const campaign = client.campaigns.find((c) => c.id === campaignId);
    if (campaign) return { client, campaign };
  }
  return undefined;
}

export function triggerSession(campaign: Campaign, loaded: LoadedSeries) {
  return loaded.sessionId
    ? campaign.sessions.find((s) => s.id === loaded.sessionId)
    : undefined;
}

// ——— scheduling ———————————————————————————————————————————

/**
 * Computes the concrete send dates for one loaded series inside a campaign.
 * The series is triggered by the date of the session it is bound to;
 * step offsets are cumulative from that date.
 */
export function computeSchedule(
  campaign: Campaign,
  loaded: LoadedSeries,
  series: SeriesTemplate,
  today: Date = new Date()
): ScheduledStep[] {
  const session = triggerSession(campaign, loaded);
  let cursor = session?.date ? new Date(`${session.date}T00:00:00`) : null;
  return series.steps.map((step) => {
    if (!cursor) {
      return { step, series, date: null, status: "unscheduled" as const };
    }
    cursor = addDays(cursor, step.offsetDays);
    const status = cursor < today ? ("sent" as const) : ("scheduled" as const);
    return { step, series, date: cursor, status };
  });
}

export interface SeriesProgress {
  series: SeriesTemplate;
  total: number;
  sent: number;
  next: ScheduledStep | null;
  /** true when the bound session has a date (sends are on the calendar) */
  scheduled: boolean;
  /** false when the series is not bound to any session yet */
  bound: boolean;
}

export function seriesProgress(
  campaign: Campaign,
  loaded: LoadedSeries,
  series: SeriesTemplate,
  today: Date = new Date()
): SeriesProgress {
  const schedule = computeSchedule(campaign, loaded, series, today);
  const sent = schedule.filter((s) => s.status === "sent").length;
  const next = schedule.find((s) => s.status === "scheduled") ?? null;
  return {
    series,
    total: schedule.length,
    sent,
    next,
    scheduled: schedule.some((s) => s.date !== null),
    bound: loaded.sessionId !== null,
  };
}

export interface UpcomingSend extends ScheduledStep {
  client: Client;
  campaign: Campaign;
}

/** All future sends across all clients and campaigns, soonest first. */
export function upcomingSends(
  clients: Client[],
  templates: SeriesTemplate[],
  today: Date = new Date()
): UpcomingSend[] {
  const out: UpcomingSend[] = [];
  for (const client of clients) {
    for (const campaign of client.campaigns) {
      for (const loaded of campaign.series) {
        const series = findTemplate(templates, loaded.templateId);
        if (!series) continue;
        for (const item of computeSchedule(campaign, loaded, series, today)) {
          if (item.status === "scheduled" && item.date) {
            out.push({ ...item, client, campaign });
          }
        }
      }
    }
  }
  return out.sort((a, b) => a.date!.getTime() - b.date!.getTime());
}

export interface DashboardStats {
  activeClients: number;
  onboardingClients: number;
  campaigns: number;
  membersEnrolled: number;
  scheduledNext30: number;
  seriesInLibrary: number;
  totalLessons: number;
}

export function dashboardStats(
  clients: Client[],
  templates: SeriesTemplate[],
  today: Date = new Date()
): DashboardStats {
  const sends = upcomingSends(clients, templates, today);
  const in30 = sends.filter((s) => s.date! <= addDays(today, 30)).length;
  return {
    activeClients: clients.filter((c) => c.status === "active").length,
    onboardingClients: clients.filter((c) => c.status === "onboarding").length,
    campaigns: clients.reduce((n, c) => n + c.campaigns.length, 0),
    membersEnrolled: clients.reduce((n, c) => n + c.members.length, 0),
    scheduledNext30: in30,
    seriesInLibrary: templates.length,
    totalLessons: templates.reduce((n, s) => n + s.steps.length, 0),
  };
}

/** Overall campaign completion, measured in sent steps vs total steps. */
export function campaignCompletion(
  campaign: Campaign,
  templates: SeriesTemplate[],
  today: Date = new Date()
): { sent: number; total: number; pct: number } {
  let sent = 0;
  let total = 0;
  for (const loaded of campaign.series) {
    const series = findTemplate(templates, loaded.templateId);
    if (!series) continue;
    const p = seriesProgress(campaign, loaded, series, today);
    sent += p.sent;
    total += p.total;
  }
  return { sent, total, pct: total ? Math.round((sent / total) * 100) : 0 };
}
