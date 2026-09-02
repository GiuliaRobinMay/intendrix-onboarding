"use client";

// Interactive prototype store. Seeded from lib/data.ts, persisted in the
// browser (localStorage) so edits survive reloads. In the Supabase phase
// these actions become database mutations behind the same interface.

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  campaignTemplates as seedCampaignTemplates,
  clients as seedClients,
  seriesTemplates as seedTemplates,
  team as seedStaff,
} from "./data";
import type {
  Campaign,
  CampaignSession,
  Member,
  CampaignTemplate,
  AppRole,
  ClientAssignmentRole,
  Invitation,
  PhoenixAssignmentRole,
  Client,
  MemberRole,
  SeriesStep,
  SeriesTemplate,
  SessionKey,
  StaffMember,
  StepContent,
} from "./types";
import { authHeaders } from "./supabase-browser";

const STORAGE_KEY = "intendrix-prototype";
/** bump when the seed shape changes so stale storage is discarded */
const SEED_VERSION = 8;

interface DB {
  seedVersion: number;
  /** app-wide values, e.g. signatureLogoUrl — the logo under every sign-off */
  settings?: Record<string, string>;
  /** the Phoenix team: one list for sign-in and for assignments */
  staff: StaffMember[];
  clients: Client[];
  invitations: Invitation[];
  /** campaign blueprints (Settings → Campaigns) */
  campaignTemplates: CampaignTemplate[];
  /** series belonging to those blueprints */
  templates: SeriesTemplate[];
}

const seed = (): DB => ({
  seedVersion: SEED_VERSION,
  settings: {},
  staff: seedStaff,
  clients: seedClients,
  invitations: [],
  campaignTemplates: seedCampaignTemplates,
  templates: seedTemplates,
});

const TRIGGER_LABELS: Record<SessionKey, string> = {
  orientation: "Orientation Session",
  workshop: "Workshop",
  coaching1: "Coaching Session 1",
  coaching2: "Coaching Session 2",
  launch: "Launch Session",
  preplanning: "Pre-Planning Session",
};

const SERIES_RAMP = ["#eb320f", "#cf3352", "#a1348c", "#6531a5", "#2c2d83"];

/** The standard five-session TLE shape, offered when creating a campaign. */
export const STANDARD_SESSIONS: Array<{
  kind: SessionKey;
  name: string;
  mode: "virtual" | "in-person";
}> = [
  { kind: "orientation", name: "Orientation Session", mode: "virtual" },
  { kind: "workshop", name: "Workshop", mode: "in-person" },
  { kind: "coaching1", name: "Coaching Session 1 · Management", mode: "virtual" },
  { kind: "coaching2", name: "Coaching Session 2 · Coaching", mode: "in-person" },
  { kind: "launch", name: "Launch Session", mode: "virtual" },
];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** ISO date arithmetic on the calendar parts only — going through a local
 *  Date would move dates across a timezone boundary. */
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole days from one ISO date to another; negative when `to` is earlier. */
export function daysBetweenIso(from: string, to: string): number {
  const at = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(to) - at(from)) / 86400000);
}

/** Pre-generated ids for a blueprint duplication, so the browser and
 *  the database create exactly the same copy. */
export interface DuplicatePlan {
  newId: string;
  series: Array<{
    sourceId: string;
    newId: string;
    steps: Array<{ sourceId: string; newId: string }>;
  }>;
}

export type Action =
  | { type: "hydrate"; db: DB }
  | { type: "reset" }
  /** app-wide value, e.g. { key: "signatureLogoUrl", value: "https://…" } */
  | { type: "setSetting"; key: string; value: string }
  // clients
  | { type: "addClient"; id?: string; name: string; location: string; sector: string }
  | { type: "removeClient"; clientId: string }
  | {
      type: "updateClient";
      clientId: string;
      patch: Partial<
        Pick<
          Client,
          | "name"
          | "location"
          | "sector"
          | "status"
          | "phoenixLeaderId"
          | "phoenixCoachId"
          | "projectManagerId"
          | "spaceUrl"
          | "inviteUrl"
        >
      >;
    }
  | {
      type: "addMember";
      id?: string;
      clientId: string;
      name: string;
      firstName?: string;
      lastName?: string;
      title: string;
      email: string;
      role: MemberRole;
    }
  | {
      type: "updateMember";
      clientId: string;
      memberId: string;
      patch: Partial<Pick<Member, "firstName" | "lastName" | "title" | "email" | "role">>;
    }
  | { type: "removeMember"; clientId: string; memberId: string }
  // campaigns
  | {
      type: "addCampaign";
      id?: string;
      /** ids for the standard sessions, generated client-side */
      sessionIds?: string[];
      clientId: string;
      name: string;
      code: string;
      timezone?: string;
      /** the campaign blueprint this is created from */
      fromTemplateId?: string;
      /** create the standard five sessions, or start empty */
      withStandardSessions: boolean;
      /** load these series templates straight away (auto-bound by kind) */
      templateIds: string[];
    }
  | { type: "removeCampaign"; clientId: string; campaignId: string }
  | {
      type: "updateCampaign";
      clientId: string;
      campaignId: string;
      patch: Partial<
        Pick<
          Campaign,
          | "name"
          | "code"
          | "timezone"
          | "statusOverride"
          | "senderMemberId"
          | "shadowEmails"
          | "startDate"
          | "endDate"
        >
      >;
    }
  // sessions (variable number per campaign)
  | { type: "addSession"; id?: string; clientId: string; campaignId: string; name?: string }
  | { type: "removeSession"; clientId: string; campaignId: string; sessionId: string }
  | {
      type: "updateSession";
      clientId: string;
      campaignId: string;
      sessionId: string;
      patch: Partial<Pick<CampaignSession, "name" | "date" | "mode" | "offsetDays">>;
    }
  /** Date every session that carries a day number, from the campaign's
   *  start date. Sessions without one keep whatever date they have. */
  | { type: "fillSessionDates"; clientId: string; campaignId: string }
  /** The reverse: read the day numbers back off the dates already
   *  entered, so this campaign's rhythm is recorded. */
  | { type: "captureSessionOffsets"; clientId: string; campaignId: string }
  /** Move every dated session AFTER this one by the same number of days,
   *  so rescheduling one meetup carries the rest of the campaign with it. */
  | {
      type: "shiftSessionsAfter";
      clientId: string;
      campaignId: string;
      sessionId: string;
      days: number;
    }
  | {
      type: "moveSession";
      clientId: string;
      campaignId: string;
      sessionId: string;
      dir: -1 | 1;
    }
  /** drag-and-drop reorder: drop a session at an absolute position */
  | {
      type: "moveSessionTo";
      clientId: string;
      campaignId: string;
      sessionId: string;
      toIndex: number;
    }
  // series loaded into a campaign
  | {
      type: "loadSeries";
      clientId: string;
      campaignId: string;
      templateIds: string[];
    }
  | { type: "unloadSeries"; clientId: string; campaignId: string; templateId: string }
  | {
      type: "bindSeries";
      clientId: string;
      campaignId: string;
      templateId: string;
      sessionId: string | null;
    }
  | {
      type: "moveSeries";
      clientId: string;
      campaignId: string;
      templateId: string;
      dir: -1 | 1;
    }
  /** This campaign's own wording of a lesson email. The master lesson
   *  stays untouched; missing fields keep falling back to it. */
  | {
      type: "overrideStepContent";
      clientId: string;
      campaignId: string;
      stepId: string;
      variant: "participant" | "leader";
      patch: { emailSubject?: string; emailBody?: string };
    }
  /** Drop the campaign's own wording — back to the master lesson. */
  | {
      type: "clearStepOverride";
      clientId: string;
      campaignId: string;
      stepId: string;
    }
  /** Cancel one lesson email for this campaign — it stays in the lists
   *  as Cancelled and the engine never sends it. */
  | {
      type: "skipStep";
      clientId: string;
      campaignId: string;
      stepId: string;
    }
  /** Undo a cancel — the lesson goes back on the schedule. */
  | {
      type: "restoreStep";
      clientId: string;
      campaignId: string;
      stepId: string;
    }
  /** drag-and-drop reorder: drop a series at an absolute position */
  | {
      type: "moveSeriesTo";
      clientId: string;
      campaignId: string;
      templateId: string;
      toIndex: number;
    }
  // module library
  | {
      type: "updateStepMeta";
      templateId: string;
      stepId: string;
      patch: Partial<Pick<SeriesStep, "code" | "title" | "offsetDays" | "sendTime">>;
    }
  | {
      type: "updateStepContent";
      templateId: string;
      stepId: string;
      variant: "participant" | "leader";
      patch: Partial<StepContent>;
    }
  | { type: "removeSeries"; templateId: string }
  /** reorder a series within its blueprint (the library, not a campaign) */
  | {
      type: "moveSeriesTemplate";
      campaignTemplateId: string;
      templateId: string;
      dir: -1 | 1;
    }
  | { type: "addStep"; id?: string; templateId: string }
  | { type: "removeStep"; templateId: string; stepId: string }
  | { type: "moveStep"; templateId: string; stepId: string; dir: -1 | 1 }
  | {
      type: "addSeries";
      id?: string;
      campaignTemplateId: string;
      name: string;
      code: string;
      focus: string;
      trigger: SessionKey;
    }
  // campaign assignments — same system on both sides
  | {
      type: "addPhoenixAssignment";
      id?: string;
      clientId: string;
      campaignId: string;
      staffId: string;
      role: PhoenixAssignmentRole;
    }
  | {
      type: "updatePhoenixAssignment";
      clientId: string;
      campaignId: string;
      assignmentId: string;
      patch: Partial<{ staffId: string; role: PhoenixAssignmentRole }>;
    }
  | {
      type: "removePhoenixAssignment";
      clientId: string;
      campaignId: string;
      assignmentId: string;
    }
  | {
      type: "addClientAssignment";
      id?: string;
      clientId: string;
      campaignId: string;
      memberId: string;
      role: ClientAssignmentRole;
    }
  | {
      type: "updateClientAssignment";
      clientId: string;
      campaignId: string;
      assignmentId: string;
      patch: Partial<{ memberId: string; role: ClientAssignmentRole }>;
    }
  | {
      type: "removeClientAssignment";
      clientId: string;
      campaignId: string;
      assignmentId: string;
    }
  // the Phoenix team — the same people who sign in
  | {
      type: "addStaff";
      id?: string;
      name: string;
      role: string;
      email: string;
    }
  | {
      type: "updateStaff";
      staffId: string;
      patch: Partial<Pick<StaffMember, "name" | "role" | "email" | "signature">>;
    }
  | { type: "removeStaff"; staffId: string }
  // invitations (mock of the Supabase invite flow)
  | {
      type: "addInvitation";
      id?: string;
      email: string;
      name?: string;
      role: AppRole;
      clientId?: string;
      /** the team member this invitation belongs to (Phoenix invites) */
      staffId?: string;
    }
  | {
      type: "updateInvitation";
      invitationId: string;
      patch: Partial<Pick<Invitation, "name" | "email" | "clientId">>;
    }
  | { type: "removeInvitation"; invitationId: string }
  // campaign blueprints
  | { type: "addCampaignTemplate"; id?: string; name: string; code: string; description: string }
  | { type: "duplicateCampaignTemplate"; templateId: string; plan?: DuplicatePlan }
  | { type: "removeCampaignTemplate"; templateId: string }
  | {
      type: "updateCampaignTemplate";
      templateId: string;
      patch: Partial<Pick<CampaignTemplate, "name" | "code" | "description">>;
    };

function mapTemplate(
  db: DB,
  templateId: string,
  fn: (t: SeriesTemplate) => SeriesTemplate
): DB {
  return {
    ...db,
    templates: db.templates.map((t) => (t.id === templateId ? fn(t) : t)),
  };
}

function mapClient(db: DB, clientId: string, fn: (c: Client) => Client): DB {
  return {
    ...db,
    clients: db.clients.map((c) => (c.id === clientId ? fn(c) : c)),
  };
}

function mapCampaign(
  db: DB,
  clientId: string,
  campaignId: string,
  fn: (c: Campaign) => Campaign
): DB {
  return mapClient(db, clientId, (client) => ({
    ...client,
    campaigns: client.campaigns.map((c) => (c.id === campaignId ? fn(c) : c)),
  }));
}

function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

function reducer(db: DB, action: Action): DB {
  switch (action.type) {
    case "hydrate":
      return action.db;

    case "reset":
      return seed();

    case "setSetting":
      return {
        ...db,
        settings: { ...(db.settings ?? {}), [action.key]: action.value },
      };

    // ——— clients ———————————————————————————————————————————

    case "addClient": {
      const client: Client = {
        id: action.id ?? uid("client"),
        name: action.name,
        shortName: action.name.split(" ")[0],
        location: action.location || "—",
        sector: action.sector || "—",
        status: "onboarding",
        members: [],
        campaigns: [],
      };
      return { ...db, clients: [...db.clients, client] };
    }

    case "removeClient":
      return { ...db, clients: db.clients.filter((c) => c.id !== action.clientId) };

    case "updateClient":
      return mapClient(db, action.clientId, (c) => ({ ...c, ...action.patch }));

    case "addMember":
      return mapClient(db, action.clientId, (c) => ({
        ...c,
        members: [
          ...c.members,
          {
            id: action.id ?? uid("member"),
            name: action.name,
            firstName: action.firstName,
            lastName: action.lastName,
            title: action.title,
            email: action.email,
            role: action.role,
          },
        ],
      }));

    case "updateMember":
      return mapClient(db, action.clientId, (c) => ({
        ...c,
        members: c.members.map((m) => {
          if (m.id !== action.memberId) return m;
          const next = { ...m, ...action.patch };
          // the display name follows its parts
          next.name = [next.firstName, next.lastName].filter(Boolean).join(" ") || m.name;
          return next;
        }),
      }));

    case "removeMember":
      return mapClient(db, action.clientId, (c) => ({
        ...c,
        members: c.members.filter((m) => m.id !== action.memberId),
      }));

    // ——— campaigns —————————————————————————————————————————

    case "addCampaign": {
      const sessions: CampaignSession[] = action.withStandardSessions
        ? STANDARD_SESSIONS.map((s, i) => ({
            id: action.sessionIds?.[i] ?? uid("session"),
            kind: s.kind,
            name: s.name,
            date: null,
            mode: s.mode,
          }))
        : [];

      // auto-bind each loaded template to the session matching its kind
      const series = action.templateIds.map((templateId) => {
        const template = db.templates.find((t) => t.id === templateId);
        const match = template
          ? sessions.find((s) => s.kind === template.trigger)
          : undefined;
        return { templateId, sessionId: match?.id ?? null };
      });

      const campaign: Campaign = {
        id: action.id ?? uid("campaign"),
        code: action.code || "TLE",
        name: action.name,
        timezone: action.timezone || "America/New_York",
        templateId: action.fromTemplateId,
        phoenixTeam: [],
        clientTeam: [],
        sessions,
        series,
      };

      return mapClient(db, action.clientId, (c) => ({
        ...c,
        status: c.status === "onboarding" ? "active" : c.status,
        campaigns: [...c.campaigns, campaign],
      }));
    }

    case "removeCampaign":
      return mapClient(db, action.clientId, (c) => ({
        ...c,
        campaigns: c.campaigns.filter((x) => x.id !== action.campaignId),
      }));

    case "updateCampaign":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        ...action.patch,
      }));

    // ——— sessions ——————————————————————————————————————————

    case "addSession":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        sessions: [
          ...c.sessions,
          {
            id: action.id ?? uid("session"),
            name: action.name ?? `Session ${c.sessions.length + 1}`,
            date: null,
            mode: "virtual",
          },
        ],
      }));

    case "removeSession":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        sessions: c.sessions.filter((s) => s.id !== action.sessionId),
        // any series bound to the removed session falls back to unbound
        series: c.series.map((s) =>
          s.sessionId === action.sessionId ? { ...s, sessionId: null } : s
        ),
      }));

    case "updateSession":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        sessions: c.sessions.map((s) =>
          s.id === action.sessionId ? { ...s, ...action.patch } : s
        ),
      }));

    case "overrideStepContent":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => {
        const rest = (c.contentOverrides ?? []).filter(
          (o) => !(o.stepId === action.stepId && o.variant === action.variant)
        );
        const existing = (c.contentOverrides ?? []).find(
          (o) => o.stepId === action.stepId && o.variant === action.variant
        );
        return {
          ...c,
          contentOverrides: [
            ...rest,
            {
              stepId: action.stepId,
              variant: action.variant,
              emailSubject: existing?.emailSubject ?? null,
              emailBody: existing?.emailBody ?? null,
              ...action.patch,
            },
          ],
        };
      });

    case "clearStepOverride":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        contentOverrides: (c.contentOverrides ?? []).filter(
          (o) => o.stepId !== action.stepId
        ),
      }));

    case "skipStep":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        skippedStepIds: [
          ...(c.skippedStepIds ?? []).filter((id) => id !== action.stepId),
          action.stepId,
        ],
      }));

    case "restoreStep":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        skippedStepIds: (c.skippedStepIds ?? []).filter(
          (id) => id !== action.stepId
        ),
      }));

    case "fillSessionDates":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => {
        if (!c.startDate) return c;
        return {
          ...c,
          sessions: c.sessions.map((s) =>
            typeof s.offsetDays === "number"
              ? { ...s, date: shiftIso(c.startDate!, s.offsetDays) }
              : s
          ),
        };
      });

    case "captureSessionOffsets":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => {
        if (!c.startDate) return c;
        return {
          ...c,
          sessions: c.sessions.map((s) =>
            s.date
              ? { ...s, offsetDays: daysBetweenIso(c.startDate!, s.date) }
              : s
          ),
        };
      });

    case "shiftSessionsAfter":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => {
        const at = c.sessions.findIndex((s) => s.id === action.sessionId);
        if (at < 0 || action.days === 0) return c;
        return {
          ...c,
          sessions: c.sessions.map((s, i) =>
            i > at && s.date
              ? {
                  ...s,
                  date: shiftIso(s.date, action.days),
                  offsetDays:
                    typeof s.offsetDays === "number"
                      ? s.offsetDays + action.days
                      : s.offsetDays,
                }
              : s
          ),
        };
      });

    case "moveSession":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        sessions: move(
          c.sessions,
          c.sessions.findIndex((s) => s.id === action.sessionId),
          action.dir
        ),
      }));

    case "moveSessionTo":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => {
        const from = c.sessions.findIndex((s) => s.id === action.sessionId);
        if (from < 0) return c;
        const to = Math.max(0, Math.min(action.toIndex, c.sessions.length - 1));
        if (from === to) return c;
        const sessions = [...c.sessions];
        const [moved] = sessions.splice(from, 1);
        sessions.splice(to, 0, moved);
        return { ...c, sessions };
      });

    // ——— the Phoenix team ——————————————————————————————————

    case "addStaff": {
      const initials = action.name
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0]!.toUpperCase())
        .slice(0, 2)
        .join("");
      return {
        ...db,
        staff: [
          ...db.staff,
          {
            id: action.id ?? uid("staff"),
            name: action.name,
            role: action.role,
            email: action.email,
            initials: initials || "?",
            access: "none",
          },
        ],
      };
    }

    case "updateStaff":
      return {
        ...db,
        staff: db.staff.map((m) =>
          m.id === action.staffId ? { ...m, ...action.patch } : m
        ),
      };

    case "removeStaff":
      return {
        ...db,
        staff: db.staff.filter((m) => m.id !== action.staffId),
        // and release them from every client default
        clients: db.clients.map((c) => ({
          ...c,
          phoenixLeaderId:
            c.phoenixLeaderId === action.staffId ? undefined : c.phoenixLeaderId,
          phoenixCoachId:
            c.phoenixCoachId === action.staffId ? undefined : c.phoenixCoachId,
          projectManagerId:
            c.projectManagerId === action.staffId ? undefined : c.projectManagerId,
          campaigns: c.campaigns.map((cp) => ({
            ...cp,
            phoenixTeam: cp.phoenixTeam.filter((a) => a.staffId !== action.staffId),
          })),
        })),
      };

    // ——— invitations ———————————————————————————————————————

    case "addInvitation":
      return {
        ...db,
        invitations: [
          ...db.invitations,
          {
            id: action.id ?? uid("inv"),
            email: action.email,
            name: action.name,
            role: action.role,
            clientId: action.clientId,
            staffId: action.staffId,
          },
        ],
        // the team list shows them as invited straight away
        staff: action.staffId
          ? db.staff.map((m) =>
              m.id === action.staffId ? { ...m, access: "invited" as const } : m
            )
          : db.staff,
      };

    case "updateInvitation":
      return {
        ...db,
        invitations: db.invitations.map((i) =>
          i.id === action.invitationId ? { ...i, ...action.patch } : i
        ),
      };

    case "removeInvitation":
      return {
        ...db,
        invitations: db.invitations.filter((i) => i.id !== action.invitationId),
      };

    // ——— campaign assignments ——————————————————————————————

    case "addPhoenixAssignment":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        phoenixTeam: [
          ...c.phoenixTeam,
          { id: action.id ?? uid("pa"), staffId: action.staffId, role: action.role },
        ],
      }));

    case "updatePhoenixAssignment":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        phoenixTeam: c.phoenixTeam.map((x) =>
          x.id === action.assignmentId ? { ...x, ...action.patch } : x
        ),
      }));

    case "removePhoenixAssignment":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        phoenixTeam: c.phoenixTeam.filter((x) => x.id !== action.assignmentId),
      }));

    case "addClientAssignment":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        clientTeam: [
          ...c.clientTeam,
          { id: action.id ?? uid("ca"), memberId: action.memberId, role: action.role },
        ],
      }));

    case "updateClientAssignment":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        clientTeam: c.clientTeam.map((x) =>
          x.id === action.assignmentId ? { ...x, ...action.patch } : x
        ),
      }));

    case "removeClientAssignment":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        clientTeam: c.clientTeam.filter((x) => x.id !== action.assignmentId),
      }));

    // ——— series inside a campaign ——————————————————————————

    case "loadSeries":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => {
        const fresh = action.templateIds
          .filter((id) => !c.series.some((s) => s.templateId === id))
          .map((templateId) => {
            const template = db.templates.find((t) => t.id === templateId);
            const match = template
              ? c.sessions.find((s) => s.kind === template.trigger)
              : undefined;
            return { templateId, sessionId: match?.id ?? null };
          });
        return { ...c, series: [...c.series, ...fresh] };
      });

    case "unloadSeries":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        series: c.series.filter((s) => s.templateId !== action.templateId),
      }));

    case "bindSeries":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        series: c.series.map((s) =>
          s.templateId === action.templateId
            ? { ...s, sessionId: action.sessionId }
            : s
        ),
      }));

    case "moveSeries":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => ({
        ...c,
        series: move(
          c.series,
          c.series.findIndex((s) => s.templateId === action.templateId),
          action.dir
        ),
      }));

    case "moveSeriesTo":
      return mapCampaign(db, action.clientId, action.campaignId, (c) => {
        const from = c.series.findIndex((s) => s.templateId === action.templateId);
        if (from < 0) return c;
        const to = Math.max(0, Math.min(action.toIndex, c.series.length - 1));
        if (from === to) return c;
        const series = [...c.series];
        const [moved] = series.splice(from, 1);
        series.splice(to, 0, moved);
        return { ...c, series };
      });

    // ——— module library ————————————————————————————————————

    case "updateStepMeta":
      return mapTemplate(db, action.templateId, (t) => ({
        ...t,
        steps: t.steps.map((s) =>
          s.id === action.stepId ? { ...s, ...action.patch } : s
        ),
      }));

    case "updateStepContent":
      return mapTemplate(db, action.templateId, (t) => ({
        ...t,
        steps: t.steps.map((s) =>
          s.id === action.stepId
            ? { ...s, [action.variant]: { ...s[action.variant], ...action.patch } }
            : s
        ),
      }));

    case "removeSeries":
      return {
        ...db,
        templates: db.templates.filter((t) => t.id !== action.templateId),
        // drop it from any campaign that had it loaded
        clients: db.clients.map((c) => ({
          ...c,
          campaigns: c.campaigns.map((cp) => ({
            ...cp,
            series: cp.series.filter((x) => x.templateId !== action.templateId),
          })),
        })),
      };

    case "addStep":
      return mapTemplate(db, action.templateId, (t) => {
        const blank: StepContent = {
          emailSubject: "New lesson email subject",
          emailBody: "Write the email that goes with this lesson.",
          lesson: { label: "Lesson link", url: null },
        };
        const step: SeriesStep = {
          id: action.id ?? uid("step"),
          code: `${t.code} ${t.steps.length + 1}`,
          title: "New lesson",
          offsetDays: 7,
          sendTime: "08:00",
          participant: blank,
          leader: { ...blank },
        };
        return { ...t, steps: [...t.steps, step] };
      });

    case "removeStep":
      return mapTemplate(db, action.templateId, (t) => ({
        ...t,
        steps: t.steps.filter((s) => s.id !== action.stepId),
      }));

    case "moveStep":
      return mapTemplate(db, action.templateId, (t) => ({
        ...t,
        steps: move(
          t.steps,
          t.steps.findIndex((s) => s.id === action.stepId),
          action.dir
        ),
      }));

    case "addSeries": {
      const siblings = db.templates.filter(
        (t) => t.campaignTemplateId === action.campaignTemplateId
      );
      const template: SeriesTemplate = {
        id: action.id ?? uid("series"),
        campaignTemplateId: action.campaignTemplateId,
        code: action.code.toUpperCase(),
        name: action.name,
        focus: action.focus || "—",
        trigger: action.trigger,
        // custom triggers are their own label
        triggerLabel: TRIGGER_LABELS[action.trigger] ?? action.trigger,
        color: SERIES_RAMP[siblings.length % SERIES_RAMP.length],
        steps: [],
      };
      return { ...db, templates: [...db.templates, template] };
    }

    case "moveSeriesTemplate": {
      const subset = db.templates.filter(
        (t) => t.campaignTemplateId === action.campaignTemplateId
      );
      const at = subset.findIndex((t) => t.id === action.templateId);
      const to = at + action.dir;
      if (at < 0 || to < 0 || to >= subset.length) return db;
      const a = db.templates.indexOf(subset[at]);
      const b = db.templates.indexOf(subset[to]);
      const templates = [...db.templates];
      [templates[a], templates[b]] = [templates[b], templates[a]];
      return { ...db, templates };
    }

    case "addCampaignTemplate": {
      const template: CampaignTemplate = {
        id: action.id ?? uid("ctpl"),
        code: action.code.toUpperCase(),
        name: action.name,
        description: action.description,
      };
      return { ...db, campaignTemplates: [...db.campaignTemplates, template] };
    }

    case "duplicateCampaignTemplate": {
      const source = db.campaignTemplates.find((t) => t.id === action.templateId);
      if (!source) return db;
      const copy: CampaignTemplate = {
        id: action.plan?.newId ?? uid("ctpl"),
        code: `${source.code}-2`,
        name: `${source.name} (copy)`,
        description: source.description,
      };
      // deep-copy the source's series and their lessons with fresh ids
      const seriesCopies = db.templates
        .filter((t) => t.campaignTemplateId === source.id)
        .map((t) => {
          const sPlan = action.plan?.series.find((x) => x.sourceId === t.id);
          return {
            ...t,
            id: sPlan?.newId ?? uid("series"),
            campaignTemplateId: copy.id,
            steps: t.steps.map((step) => ({
              ...step,
              id:
                sPlan?.steps.find((y) => y.sourceId === step.id)?.newId ??
                uid("step"),
              participant: { ...step.participant },
              leader: { ...step.leader },
            })),
          };
        });
      return {
        ...db,
        campaignTemplates: [...db.campaignTemplates, copy],
        templates: [...db.templates, ...seriesCopies],
      };
    }

    case "removeCampaignTemplate":
      return {
        ...db,
        campaignTemplates: db.campaignTemplates.filter(
          (t) => t.id !== action.templateId
        ),
        // its series go with it
        templates: db.templates.filter(
          (t) => t.campaignTemplateId !== action.templateId
        ),
      };

    case "updateCampaignTemplate":
      return {
        ...db,
        campaignTemplates: db.campaignTemplates.map((t) =>
          t.id === action.templateId ? { ...t, ...action.patch } : t
        ),
      };
  }
}

/** Where the data lives: the shared database (Supabase) when the server
 *  is configured, otherwise this browser's storage (prototype mode). */
export type Backend = "loading" | "database" | "browser";

interface DataContextValue {
  /** the Phoenix team — assignable people and sign-in accounts in one list */
  staff: StaffMember[];
  clients: Client[];
  invitations: Invitation[];
  campaignTemplates: CampaignTemplate[];
  templates: SeriesTemplate[];
  /** app-wide values — absent keys simply mean "not set yet" */
  settings: Record<string, string>;
  backend: Backend;
  /** true when a change could not be saved to the database */
  syncError: boolean;
  dispatch: (action: Action) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Generate the ids a creating action needs, so the browser and the
 *  database end up with exactly the same rows. */
function prepareAction(action: Action, db: DB): Action {
  switch (action.type) {
    case "addClient":
      return { ...action, id: action.id ?? uid("client") };
    case "addMember":
      return { ...action, id: action.id ?? uid("member") };
    case "addCampaign":
      return {
        ...action,
        id: action.id ?? uid("campaign"),
        sessionIds:
          action.sessionIds ??
          (action.withStandardSessions
            ? STANDARD_SESSIONS.map(() => uid("session"))
            : []),
      };
    case "addSession":
      return { ...action, id: action.id ?? uid("session") };
    case "addPhoenixAssignment":
      return { ...action, id: action.id ?? uid("pa") };
    case "addClientAssignment":
      return { ...action, id: action.id ?? uid("ca") };
    case "addInvitation":
      return { ...action, id: action.id ?? uid("inv") };
    case "addStaff":
      return { ...action, id: action.id ?? uid("staff") };
    case "addStep":
      return { ...action, id: action.id ?? uid("step") };
    case "addSeries":
      return { ...action, id: action.id ?? uid("series") };
    case "addCampaignTemplate":
      return { ...action, id: action.id ?? uid("ctpl") };
    case "duplicateCampaignTemplate":
      return {
        ...action,
        plan:
          action.plan ??
          {
            newId: uid("ctpl"),
            series: db.templates
              .filter((t) => t.campaignTemplateId === action.templateId)
              .map((t) => ({
                sourceId: t.id,
                newId: uid("series"),
                steps: t.steps.map((step) => ({
                  sourceId: step.id,
                  newId: uid("step"),
                })),
              })),
          },
      };
    default:
      return action;
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, rawDispatch] = useReducer(reducer, undefined, seed);
  const [backend, setBackend] = useState<Backend>("loading");
  const [syncError, setSyncError] = useState(false);

  const dbRef = useRef(db);
  const backendRef = useRef(backend);
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    dbRef.current = db;
  }, [db]);
  useEffect(() => {
    backendRef.current = backend;
  }, [backend]);

  // pick the backend: the shared database when the server has one,
  // otherwise this browser's storage
  useEffect(() => {
    let cancelled = false;
    const hydrateFromBrowser = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DB;
          if (parsed.seedVersion === SEED_VERSION) {
            rawDispatch({ type: "hydrate", db: parsed });
          }
        }
      } catch {
        // corrupted storage — fall back to seed
      }
      setBackend("browser");
    };
    authHeaders()
      .then((headers) => fetch("/api/state", { headers }))
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.configured && res.db) {
          rawDispatch({
            type: "hydrate",
            db: { seedVersion: SEED_VERSION, ...res.db },
          });
          setBackend("database");
        } else {
          hydrateFromBrowser();
        }
      })
      .catch(() => {
        if (!cancelled) hydrateFromBrowser();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // browser mode persists locally; database mode persists via /api/action
  useEffect(() => {
    if (backend === "browser") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch {
        // storage full/unavailable — prototype keeps working in memory
      }
    }
  }, [db, backend]);

  const dispatch = (action: Action) => {
    // wiping demo data is a prototype-only tool
    if (action.type === "reset" && backendRef.current === "database") return;
    const prepared = prepareAction(action, dbRef.current);
    rawDispatch(prepared);
    if (
      backendRef.current === "database" &&
      prepared.type !== "hydrate" &&
      prepared.type !== "reset"
    ) {
      // `undefined` disappears in JSON — send explicit nulls so clearing
      // a field (e.g. the status override) reaches the database
      const body = JSON.stringify({ action: prepared }, (_k, v) =>
        v === undefined ? null : v
      );
      queue.current = queue.current.then(() =>
        authHeaders()
          .then((auth) =>
            fetch("/api/action", {
              method: "POST",
              headers: { "content-type": "application/json", ...auth },
              body,
            })
          )
          .then((r) => {
            if (!r.ok) throw new Error(String(r.status));
          })
          .catch(() => setSyncError(true))
      );
    }
  };

  return (
    <DataContext.Provider
      value={{
        staff: db.staff,
        clients: db.clients,
        invitations: db.invitations,
        campaignTemplates: db.campaignTemplates,
        templates: db.templates,
        settings: db.settings ?? {},
        backend,
        syncError,
        dispatch,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
