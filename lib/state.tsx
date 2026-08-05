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
  type ReactNode,
} from "react";
import { clients as seedClients, seriesTemplates as seedTemplates } from "./data";
import type {
  Client,
  ClientProgram,
  MemberRole,
  SeriesStep,
  SeriesTemplate,
  SessionKey,
  StepContent,
} from "./types";

const STORAGE_KEY = "intendrix-prototype";
const SEED_VERSION = 1;

interface DB {
  seedVersion: number;
  clients: Client[];
  templates: SeriesTemplate[];
}

const seed = (): DB => ({
  seedVersion: SEED_VERSION,
  clients: seedClients,
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

const DEFAULT_SESSIONS: ClientProgram["sessions"] = [
  { key: "orientation", name: "Orientation Session", date: null, mode: "virtual" },
  { key: "workshop", name: "Workshop", date: null, mode: "in-person" },
  { key: "coaching1", name: "Coaching Session 1 · Management", date: null, mode: "virtual" },
  { key: "coaching2", name: "Coaching Session 2 · Coaching", date: null, mode: "in-person" },
  { key: "launch", name: "Launch Session", date: null, mode: "virtual" },
];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export type Action =
  | { type: "hydrate"; db: DB }
  | { type: "reset" }
  | { type: "addClient"; name: string; location: string; sector: string }
  | {
      type: "addMember";
      clientId: string;
      name: string;
      title: string;
      email: string;
      role: MemberRole;
    }
  | { type: "removeMember"; clientId: string; memberId: string }
  | {
      type: "setSessionDate";
      clientId: string;
      programId: string;
      sessionKey: SessionKey;
      date: string | null;
    }
  | { type: "loadModules"; clientId: string; templateIds: string[] }
  | { type: "unloadModule"; clientId: string; templateId: string }
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
  | { type: "addStep"; templateId: string }
  | { type: "removeStep"; templateId: string; stepId: string }
  | { type: "moveStep"; templateId: string; stepId: string; dir: -1 | 1 }
  | {
      type: "addSeries";
      name: string;
      code: string;
      focus: string;
      trigger: SessionKey;
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

function reducer(db: DB, action: Action): DB {
  switch (action.type) {
    case "hydrate":
      return action.db;

    case "reset":
      return seed();

    case "addClient": {
      const client: Client = {
        id: uid("client"),
        name: action.name,
        shortName: action.name.split(" ")[0],
        location: action.location || "—",
        sector: action.sector || "—",
        status: "onboarding",
        members: [],
        programs: [],
      };
      return { ...db, clients: [...db.clients, client] };
    }

    case "addMember":
      return mapClient(db, action.clientId, (c) => ({
        ...c,
        members: [
          ...c.members,
          {
            id: uid("member"),
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

    case "setSessionDate":
      return mapClient(db, action.clientId, (c) => ({
        ...c,
        programs: c.programs.map((p) =>
          p.id === action.programId
            ? {
                ...p,
                sessions: p.sessions.map((s) =>
                  s.key === action.sessionKey ? { ...s, date: action.date } : s
                ),
              }
            : p
        ),
      }));

    case "loadModules":
      return mapClient(db, action.clientId, (c) => {
        if (c.programs.length === 0) {
          const program: ClientProgram = {
            id: uid("program"),
            code: "TLE-E",
            name: "Transformational Leadership Experience for Executives",
            timezone: "America/New_York",
            sessions: DEFAULT_SESSIONS,
            seriesIds: action.templateIds,
          };
          return { ...c, status: "active", programs: [program] };
        }
        return {
          ...c,
          programs: c.programs.map((p, i) =>
            i === 0
              ? {
                  ...p,
                  seriesIds: [
                    ...p.seriesIds,
                    ...action.templateIds.filter((t) => !p.seriesIds.includes(t)),
                  ],
                }
              : p
          ),
        };
      });

    case "unloadModule":
      return mapClient(db, action.clientId, (c) => ({
        ...c,
        programs: c.programs.map((p, i) =>
          i === 0
            ? { ...p, seriesIds: p.seriesIds.filter((t) => t !== action.templateId) }
            : p
        ),
      }));

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

    case "addStep":
      return mapTemplate(db, action.templateId, (t) => {
        const blank: StepContent = {
          emailSubject: "New lesson email subject",
          emailBody: "Write the email that goes with this lesson.",
          lesson: { label: "Lesson link", url: null },
        };
        const step: SeriesStep = {
          id: uid("step"),
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
      return mapTemplate(db, action.templateId, (t) => {
        const i = t.steps.findIndex((s) => s.id === action.stepId);
        const j = i + action.dir;
        if (i < 0 || j < 0 || j >= t.steps.length) return t;
        const steps = [...t.steps];
        [steps[i], steps[j]] = [steps[j], steps[i]];
        return { ...t, steps };
      });

    case "addSeries": {
      const template: SeriesTemplate = {
        id: uid("series"),
        code: action.code.toUpperCase(),
        name: action.name,
        focus: action.focus || "—",
        trigger: action.trigger,
        triggerLabel: TRIGGER_LABELS[action.trigger],
        color: SERIES_RAMP[db.templates.length % SERIES_RAMP.length],
        steps: [],
      };
      return { ...db, templates: [...db.templates, template] };
    }
  }
}

interface DataContextValue {
  clients: Client[];
  templates: SeriesTemplate[];
  dispatch: (action: Action) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, dispatch] = useReducer(reducer, undefined, seed);
  const hydrated = useRef(false);

  // load persisted edits after mount (SSR and first client render use the seed)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DB;
        if (parsed.seedVersion === SEED_VERSION) {
          dispatch({ type: "hydrate", db: parsed });
        }
      }
    } catch {
      // corrupted storage — fall back to seed
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (hydrated.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch {
        // storage full/unavailable — prototype keeps working in memory
      }
    }
  }, [db]);

  return (
    <DataContext.Provider value={{ clients: db.clients, templates: db.templates, dispatch }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
