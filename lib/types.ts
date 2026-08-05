// Core domain model for the Intendrix team backend.
// In the mockup phase this is served from lib/data.ts through lib/store.ts;
// in the Supabase phase the same shapes become tables.

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

export interface SeriesTemplate {
  id: string;
  code: string; // POEA, PWEA, PCS1, PCS2, PLS
  name: string;
  focus: string;
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

export interface ProgramSession {
  key: SessionKey;
  name: string;
  /** ISO date, or null = not yet planned (series stays unscheduled) */
  date: string | null;
  mode: "virtual" | "in-person";
}

export interface ClientProgram {
  id: string;
  code: string; // e.g. TLE-E
  name: string;
  timezone: string;
  sessions: ProgramSession[];
  /** series templates loaded into this program (per-client copy in the real build) */
  seriesIds: string[];
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
  programs: ClientProgram[];
}

export interface ScheduledStep {
  step: SeriesStep;
  series: SeriesTemplate;
  date: Date | null;
  status: "sent" | "scheduled" | "unscheduled";
}
