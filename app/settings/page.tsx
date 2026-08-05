"use client";

import {
  Building2,
  DatabaseBackup,
  Mail,
  Palette,
  Plug,
  Users,
} from "lucide-react";
import { PageHeader, Chip, GhostButton } from "@/components/ui";
import { team } from "@/lib/data";
import { useData } from "@/lib/state";

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
    desc: "Database, auth (Google sign-in) and storage.",
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
  {
    name: "Vercel",
    desc: "Hosting and deployments from GitHub.",
    status: "Ready",
  },
];

export default function SettingsPage() {
  const { dispatch } = useData();
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Organization, team, sending and integrations."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Organization */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
            <Building2 size={17} className="text-mist" /> Organization
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-mist">Name</dt>
              <dd className="mt-1 font-semibold">Intendrix</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-mist">Community</dt>
              <dd className="mt-1 font-semibold">intendrix.ai</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-mist">Default timezone</dt>
              <dd className="mt-1 font-semibold">America/New_York</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-mist">Default send time</dt>
              <dd className="mt-1 font-semibold">08:00</dd>
            </div>
          </dl>
        </section>

        {/* Sending */}
        <section className="card p-6">
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

        {/* Team */}
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Users size={17} className="text-mist" /> Team
            </h2>
            <GhostButton>+ Invite (Google sign-in, phase 2)</GhostButton>
          </div>
          <ul className="flex flex-col gap-2">
            {team.map((t) => (
              <li key={t.name} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <div className="brand-gradient flex size-9 items-center justify-center rounded-full text-xs font-bold">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-mist">{t.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Branding */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
            <Palette size={17} className="text-mist" /> Branding
          </h2>
          <div className="flex flex-wrap gap-3">
            {palette.map((c) => (
              <div key={c.hex} className="text-center">
                <div
                  className="size-14 rounded-xl border border-white/10"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="mt-1.5 text-[11px] font-semibold">{c.name}</p>
                <p className="text-[10px] text-mist">{c.hex}</p>
              </div>
            ))}
            <div className="text-center">
              <div className="brand-gradient size-14 rounded-xl" />
              <p className="mt-1.5 text-[11px] font-semibold">Gradient</p>
              <p className="text-[10px] text-mist">flame → indigo</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-mist">
            Logo placeholder in use — swap in the official logo file when provided.
          </p>
        </section>

        {/* Prototype data */}
        <section className="card p-6 xl:col-span-2">
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold">
            <DatabaseBackup size={17} className="text-mist" /> Prototype data
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-mist">
            In this mockup phase, your edits (clients, dates, emails, series) are
            saved in this browser only. The Supabase phase moves everything to a
            shared database with Google sign-in for the team.
          </p>
          <div className="mt-4">
            <GhostButton
              onClick={() => {
                if (confirm("Reset all prototype data back to the demo state?")) {
                  dispatch({ type: "reset" });
                }
              }}
            >
              Reset demo data
            </GhostButton>
          </div>
        </section>

        {/* Integrations */}
        <section className="card p-6 xl:col-span-2">
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
    </>
  );
}
