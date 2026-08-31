"use client";

import { useEffect, useState } from "react";
import { Building2, Check, DatabaseBackup, Mail, Palette, Plug, Type } from "lucide-react";
import { Chip, GhostButton } from "@/components/ui";
import { useData } from "@/lib/state";
import { useConfirm } from "@/components/confirm";

/** Typeface choice — applied app-wide, persisted in this browser. */
const FONTS = [
  {
    id: "system",
    label: "System default",
    stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  { id: "inter", label: "Inter", stack: '"Inter", ui-sans-serif, system-ui, sans-serif' },
  { id: "nunito", label: "Nunito", stack: '"Nunito", ui-sans-serif, system-ui, sans-serif' },
  { id: "poppins", label: "Poppins", stack: '"Poppins", ui-sans-serif, system-ui, sans-serif' },
  {
    id: "helvetica",
    label: "Helvetica",
    stack: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { id: "times", label: "Times", stack: '"Times New Roman", Times, serif' },
];

function TypefaceCard() {
  const [fontId, setFontId] = useState("system");
  useEffect(() => {
    try {
      setFontId(localStorage.getItem("intendrix-font") ?? "system");
    } catch {
      // storage unavailable — show the default
    }
  }, []);

  const choose = (id: string) => {
    const font = FONTS.find((f) => f.id === id);
    if (!font) return;
    setFontId(id);
    document.documentElement.style.setProperty("--app-font", font.stack);
    try {
      localStorage.setItem("intendrix-font", id);
      localStorage.setItem("intendrix-font-stack", font.stack);
    } catch {
      // storage unavailable — applies for this visit only
    }
  };

  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
        <Type size={17} className="text-mist" /> Typeface
      </h2>
      <p className="mb-4 text-xs text-mist">
        Try the design in a different font — applies everywhere, saved in this
        browser.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {FONTS.map((f) => {
          const on = f.id === fontId;
          return (
            <button
              key={f.id}
              data-tip={`Preview the whole app in ${f.label}`}
              onClick={() => choose(f.id)}
              className={`cursor-pointer rounded-md border px-3 py-2.5 text-left transition-colors ${
                on
                  ? "border-white/25 bg-white/6"
                  : "border-white/10 hover:border-white/25"
              }`}
              style={{ fontFamily: f.stack }}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold leading-none">Aa</span>
                {on && <Check size={14} className="shrink-0 text-mist" />}
              </span>
              <span className="mt-1.5 block truncate text-xs font-semibold">
                {f.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const palette = [
  { hex: "#050714", name: "Ink" },
  { hex: "#14143c", name: "Navy" },
  { hex: "#2c2d83", name: "Indigo" },
  { hex: "#eb320f", name: "Flame" },
  { hex: "#aeb0b2", name: "Mist" },
  { hex: "#eeeeef", name: "Paper" },
];

const integrations = [
  {
    name: "Supabase",
    desc: "Database, auth (email + password) and storage.",
    status: "Planned · phase 2",
  },
  {
    name: "Email sending",
    desc: "Transactional sends from your own domain — provider to decide (e.g. Resend).",
    status: "To decide",
  },
  {
    name: "Mighty Networks",
    desc: "Client-facing embed; member identity via Headless API is one option.",
    status: "Strategy open",
  },
  { name: "Vercel", desc: "Hosting and deployments from GitHub.", status: "Ready" },
];

export default function AppSettingsPage() {
  const confirmDelete = useConfirm();
  const { backend, dispatch } = useData();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Organization */}
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
          <Building2 size={17} className="text-mist" /> Organization
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-mist">Name</dt>
            <dd className="mt-1 font-semibold">Intendrix</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-mist">Community</dt>
            <dd className="mt-1 font-semibold">intendrix.ai</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-mist">
              Default timezone
            </dt>
            <dd className="mt-1 font-semibold">America/New_York</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-mist">
              Default send time
            </dt>
            <dd className="mt-1 font-semibold">08:00</dd>
          </div>
        </dl>
      </section>

      {/* Sending */}
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
          <Mail size={17} className="text-mist" /> Email sending
        </h2>
        <p className="text-sm leading-relaxed text-mist">
          Lesson emails go out from your own domain — never as Mighty Networks
          invites — so they land in inboxes, not spam. Sender name, from-address
          and reply-to become editable here once the sending provider is connected.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Chip color="#ff7a55">Provider to decide</Chip>
          <Chip>From-address to configure</Chip>
        </div>
      </section>

      {/* Branding */}
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
          <Palette size={17} className="text-mist" /> Branding
        </h2>
        <div className="flex flex-wrap gap-3">
          {palette.map((c) => (
            <div key={c.hex} className="text-center">
              <div
                className="size-14 rounded-md border border-white/10"
                style={{ backgroundColor: c.hex }}
              />
              <p className="mt-1.5 text-[11px] font-semibold">{c.name}</p>
              <p className="text-[10px] text-mist">{c.hex}</p>
            </div>
          ))}
          <div className="text-center">
            <div className="brand-gradient size-14 rounded-md" />
            <p className="mt-1.5 text-[11px] font-semibold">Gradient</p>
            <p className="text-[10px] text-mist">flame → indigo</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-mist">
          Logo placeholder in use — swap in the official logo file when provided.
        </p>
      </section>

      <TypefaceCard />

      {/* Prototype data */}
      <section className="card p-5">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold">
          <DatabaseBackup size={17} className="text-mist" /> Prototype data
        </h2>
        <p className="text-sm leading-relaxed text-mist">
          {backend === "database"
            ? "The app is connected to the shared Supabase database — every edit (clients, campaigns, dates, emails, series) is saved there for the whole team."
            : "In this prototype phase, your edits (clients, campaigns, dates, emails, series) are saved in this browser only. Once the shared database is connected, everything is stored there for the whole team."}
        </p>
        <div className="mt-4">
          {backend !== "database" && (
          <GhostButton
            tip="Wipe your local edits and restore the demo data"
            onClick={async () => {
              if (
                await confirmDelete({
                  name: "all prototype data",
                  detail: "Wipes every edit in this browser and restores the demo state. Only affects prototype mode — a connected database is never touched.",
                  verb: "Reset",
                })
              ) {
                dispatch({ type: "reset" });
              }
            }}
          >
            Reset demo data
          </GhostButton>
          )}
        </div>
      </section>

      {/* Integrations */}
      <section className="card p-5 xl:col-span-2">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
          <Plug size={17} className="text-mist" /> Integrations
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {integrations.map((i) => (
            <div key={i.name} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{i.name}</p>
                <Chip color={i.status === "Ready" ? "#4ade80" : undefined}>{i.status}</Chip>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-mist">{i.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
