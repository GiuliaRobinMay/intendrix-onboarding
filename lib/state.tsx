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
} from "./data";
import type {
  Campaign,
  CampaignSession,
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
  StepContent,
} from "./types";

const STORAGE_KEY = "intendrix-prototype";
/** bump when the seed shape changes so stale storage is discarded */
const SEED_VERSION = 8;

interface DB {
  seedVersion: number;
  clients: Client[];
  invitations: Invitation[];
  /** campaign blueprints (Settings → Campaigns) */
  campaignTemplates: CampaignTemplate[];
  /** series belonging to those blueprints */
  templates: SeriesTemplate[];
}

const seed = (): DB => ({
  seedVersion: SEED_VERSION,
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
      title: string;
      email: string;
      role: MemberRole;
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
      patch: Partial<Pick<CampaignSession, "name" | "date" | "mode">>;
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
  // invitations (mock of the Supabase invite flow)
  | { type: "addInvitation"; id?: string; email: string; role: AppRole; clientId?: string }
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
            title: action.title,
            email: action.email,
            role: action.role,
          },
        ],
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

    // ——— invitations ———————————————————————————————————————

    case "addInvitation":
      return {
        ...db,
        invitations: [
          ...db.invitations,
          {
            id: action.id ?? uid("inv"),
            email: action.email,
            role: action.role,
            clientId: action.clientId,
          },
        ],
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
        triggerLabel: TRIGGER_LABELS[action.trigger],
        color: SERIES_RAMP[siblings.length % SERIES_RAMP.length],
        steps: [],
      };
      return { ...db, templates: [...db.templates, template] };
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
  clients: Client[];
  invitations: Invitation[];
  campaignTemplates: CampaignTemplate[];
  templates: SeriesTemplate[];
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
    fetch("/api/state")
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
        fetch("/api/action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        })
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
        clients: db.clients,
        invitations: db.invitations,
        campaignTemplates: db.campaignTemplates,
        templates: db.templates,
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
