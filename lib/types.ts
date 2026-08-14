// Core domain model for the Intendrix team backend.
// In the prototype phase this is served from lib/data.ts through
// lib/state.tsx; in the Supabase phase the same shapes become tables.

/** Standard session kinds — used to auto-bind series templates when a
 *  campaign is created. Campaigns can also contain custom sessions. */
export type SessionKey =
  | "orientation"
  | "workshop"
  | "coaching1"
  | "coaching2"
  | "launch";

export interface LessonLink {
  label: string;
  /** null = link not yet available (flagged in the UI) */
  url: string | null;
}

/** Content of one send, per audience variant. */
export interface StepContent {
  emailSubject: string;
  emailBody: string;
  lesson?: LessonLink;
  /** Leaders Guides and other extra links (leader variant only, usually) */
  extras?: LessonLink[];
  /** TEAM MEETING instruction embedded in this send, if any */
  teamMeeting?: string;
  /** production note / open item */
  note?: string;
}

export interface SeriesStep {
  id: string;
  /** legacy label from the Bomb Bomb era, e.g. "POEA 1.4" — display only */
  code: string;
  title: string;
  /** days after the previous step (for the first step: after the trigger session) */
  offsetDays: number;
  /** local send time, e.g. "08:00" */
  sendTime: string;
  participant: StepContent;
  leader: StepContent;
}

/**
 * A campaign blueprint in Settings → Campaigns: the reusable design of a
 * whole programme (e.g. TLE for Executives), holding the series that make
 * it up. Client campaigns are created from one of these.
 */
export interface CampaignTemplate {
  id: string;
  code: string; // e.g. TLE-E
  name: string; // e.g. TLE for Executives
  description: string;
}

export interface SeriesTemplate {
  id: string;
  /** the campaign blueprint this series belongs to */
  campaignTemplateId: string;
  code: string; // POEA, PWEA, PCS1, PCS2, PLS
  name: string;
  focus: string;
  /** default binding: the standard session kind that usually triggers this series */
  trigger: SessionKey;
  triggerLabel: string;
  /** series accent colour — a stop on the red→indigo brand ramp */
  color: string;
  steps: SeriesStep[];
}

export type MemberRole = "leader" | "participant" | "coach";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  title?: string;
}

/** A live or online meeting inside a campaign. Campaigns can have any
 *  number of sessions — zero, five, or more. */
export interface CampaignSession {
  id: string;
  name: string;
  /** ISO date, or null = not yet planned (bound series stay unscheduled) */
  date: string | null;
  mode: "virtual" | "in-person";
  /** standard kind for auto-binding series templates; custom sessions omit it */
  kind?: SessionKey;
}

/** A series template loaded into a campaign, bound to the session whose
 *  date triggers it. Rebinding lets the team mix the series order. */
export interface LoadedSeries {
  templateId: string;
  /** id of the triggering session in this campaign; null = not bound yet */
  sessionId: string | null;
}

/** Someone on the Intendrix team. */
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  initials: string;
}

/**
 * Where a campaign stands. Derived from the schedule by default:
 * nothing started yet → upcoming, everything sent → closed, otherwise
 * active. `statusOverride` lets the team close or reopen one by hand.
 */
export type CampaignStatus = "upcoming" | "active" | "closed";

export interface Campaign {
  id: string;
  code: string; // e.g. TLE-E
  name: string;
  timezone: string;
  /** the campaign blueprint this was created from, if any */
  templateId?: string;
  /** Intendrix staff responsible for this campaign */
  accountManagerId?: string;
  campaignManagerId?: string;
  /** manual status; when absent the status is derived from the schedule */
  statusOverride?: CampaignStatus;
  sessions: CampaignSession[];
  series: LoadedSeries[];
}

export type ClientStatus = "active" | "onboarding" | "archived";

export interface Client {
  id: string;
  name: string;
  shortName: string;
  location: string;
  sector: string;
  status: ClientStatus;
  members: Member[];
  campaigns: Campaign[];
}

export interface ScheduledStep {
  step: SeriesStep;
  series: SeriesTemplate;
  date: Date | null;
  status: "sent" | "scheduled" | "unscheduled";
}
