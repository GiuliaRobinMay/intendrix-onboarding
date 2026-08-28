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
  /** days after the campaign's start date on which this session falls.
   *  Filling the start date can then date the whole campaign at once. */
  offsetDays?: number | null;
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

/** Someone on the Phoenix team. This is one list: the people who can
 *  sign in AND the people who can be assigned to clients and campaigns.
 *  Inviting someone to the app adds them here. */
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  /** the unique sender address their communications go out from */
  email: string;
  /** how their lesson emails sign off, one line per line. Empty falls
   *  back to their name and role. */
  signature?: string;
  /** sign-in status — derived, not stored:
   *  active = has an account, invited = invitation sent and pending,
   *  none = in the team list but never invited */
  access?: "active" | "invited" | "none";
}

/**
 * Where a campaign stands. Derived from the schedule by default:
 * nothing started yet → upcoming, everything sent → closed, otherwise
 * active. `statusOverride` lets the team close or reopen one by hand.
 */
export type CampaignStatus = "upcoming" | "active" | "paused" | "closed";

/** A Phoenix team member assigned to a campaign with a role. Any number
 *  of people per campaign — two coaches is fine. */
export type PhoenixAssignmentRole =
  | "phoenix_leader"
  | "phoenix_coach"
  | "project_manager";

export interface PhoenixAssignment {
  id: string;
  staffId: string;
  role: PhoenixAssignmentRole;
}

/** A client member assigned to a campaign with a role — chosen from the
 *  client's members list, same system as the Phoenix side. */
export type ClientAssignmentRole = "champion" | "contact";

export interface ClientAssignment {
  id: string;
  memberId: string;
  role: ClientAssignmentRole;
}

export interface Campaign {
  id: string;
  code: string; // e.g. TLE-E
  name: string;
  timezone: string;
  /** the campaign blueprint this was created from, if any */
  templateId?: string;
  /** Phoenix people assigned to this campaign (person + role). When a
   *  role has no assignment, the client's default applies. The Coach is
   *  the one the emails are sent from. */
  phoenixTeam: PhoenixAssignment[];
  /** client members assigned to this campaign (member + role), e.g. the
   *  Client Transformational Champion */
  clientTeam: ClientAssignment[];
  /** manual status; when absent the status is derived from the schedule.
   *  "paused" holds all sends until the campaign is reopened. */
  statusOverride?: CampaignStatus;
  /** When set, this client member is the sender instead of the Phoenix
   *  coach — e.g. the Transformational Champion on a second-level
   *  programme. Their name is what recipients see; the address stays on
   *  the sending domain, with their own address as reply-to. */
  senderMemberId?: string | null;
  /** addresses that receive one copy of every lesson this campaign sends
   *  — the coordinator watching a live programme from the outside.
   *  Comma-separated. They are never personalised or counted as members. */
  shadowEmails?: string | null;
  /** campaign runs from/to — shown as milestones in the Calendar */
  startDate?: string | null;
  endDate?: string | null;
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
  /** Phoenix staff responsible for this organization. Campaigns can
   *  override each of these. The Coach is the one emails are sent from. */
  phoenixLeaderId?: string;
  phoenixCoachId?: string;
  projectManagerId?: string;
  /** the client's space inside Mighty Networks */
  spaceUrl?: string;
  /** the plan invitation link members use to join that space */
  inviteUrl?: string;
  members: Member[];
  campaigns: Campaign[];
}

/** A pending invitation created from inside the app. In the Supabase
 *  phase this row triggers an invite email; the person signs in with
 *  their email address and sets their own password. */
export type AppRole = "phoenix_admin" | "client_admin";

export interface Invitation {
  id: string;
  email: string;
  /** the person's name, so the list reads like the team list */
  name?: string;
  role: AppRole;
  /** required for client_admin: the one company they may see */
  clientId?: string;
  /** Phoenix invites point at the team member they belong to, so the
   *  account and the assignable person are one and the same */
  staffId?: string;
}

export interface ScheduledStep {
  step: SeriesStep;
  series: SeriesTemplate;
  date: Date | null;
  status: "sent" | "scheduled" | "unscheduled";
}
