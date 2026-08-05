// Pure scheduling/statistics helpers. State lives in lib/state.tsx (the
// interactive prototype store); in the Supabase phase these same functions
// run against rows from the database.

import type {
  Client,
  ClientProgram,
  ScheduledStep,
  SeriesTemplate,
  SessionKey,
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

function sessionDate(program: ClientProgram, key: SessionKey): Date | null {
  const s = program.sessions.find((x) => x.key === key);
  return s?.date ? new Date(`${s.date}T00:00:00`) : null;
}

export function findTemplate(
  templates: SeriesTemplate[],
  id: string
): SeriesTemplate | undefined {
  return templates.find((t) => t.id === id);
}

// ——— scheduling ———————————————————————————————————————————

/**
 * Computes the concrete send dates for one series inside one program.
 * The series is triggered by the date of the session it follows;
 * step offsets are cumulative from that date.
 */
export function computeSchedule(
  program: ClientProgram,
  series: SeriesTemplate,
  today: Date = new Date()
): ScheduledStep[] {
  const trigger = sessionDate(program, series.trigger);
  let cursor = trigger;
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
  scheduled: boolean;
}

export function seriesProgress(
  program: ClientProgram,
  series: SeriesTemplate,
  today: Date = new Date()
): SeriesProgress {
  const schedule = computeSchedule(program, series, today);
  const sent = schedule.filter((s) => s.status === "sent").length;
  const next = schedule.find((s) => s.status === "scheduled") ?? null;
  return {
    series,
    total: schedule.length,
    sent,
    next,
    scheduled: schedule.some((s) => s.date !== null),
  };
}

export interface UpcomingSend extends ScheduledStep {
  client: Client;
  program: ClientProgram;
}

/** All future sends across all clients, soonest first. */
export function upcomingSends(
  clients: Client[],
  templates: SeriesTemplate[],
  today: Date = new Date()
): UpcomingSend[] {
  const out: UpcomingSend[] = [];
  for (const client of clients) {
    for (const program of client.programs) {
      for (const seriesId of program.seriesIds) {
        const series = findTemplate(templates, seriesId);
        if (!series) continue;
        for (const item of computeSchedule(program, series, today)) {
          if (item.status === "scheduled" && item.date) {
            out.push({ ...item, client, program });
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
    membersEnrolled: clients.reduce((n, c) => n + c.members.length, 0),
    scheduledNext30: in30,
    seriesInLibrary: templates.length,
    totalLessons: templates.reduce((n, s) => n + s.steps.length, 0),
  };
}

/** Overall program completion, measured in sent steps vs total steps. */
export function programCompletion(
  program: ClientProgram,
  templates: SeriesTemplate[],
  today: Date = new Date()
): { sent: number; total: number; pct: number } {
  let sent = 0;
  let total = 0;
  for (const id of program.seriesIds) {
    const series = findTemplate(templates, id);
    if (!series) continue;
    const p = seriesProgress(program, series, today);
    sent += p.sent;
    total += p.total;
  }
  return { sent, total, pct: total ? Math.round((sent / total) * 100) : 0 };
}
