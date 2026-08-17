"use client";

import { ShieldCheck, UserPlus } from "lucide-react";
import { Chip, GhostButton } from "@/components/ui";
import { team } from "@/lib/data";

export default function TeamSettingsPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="card p-6 xl:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Users</h2>
          <GhostButton tip="Real invitations arrive with sign-in in the Supabase phase">
            <span className="flex items-center gap-2">
              <UserPlus size={14} /> Invite user
            </span>
          </GhostButton>
        </div>

        <ul className="flex flex-col gap-1">
          {team.map((t) => (
            <li
              key={t.name}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/4"
            >
              <div className="brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {t.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.name}</p>
                <p className="truncate text-xs text-mist">{t.role}</p>
              </div>
              <Chip>Admin</Chip>
            </li>
          ))}
        </ul>
      </section>

      <section className="card self-start p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <ShieldCheck size={17} className="text-mist" /> Sign-in
        </h2>
        <p className="text-sm leading-relaxed text-mist">
          The team signs in with email and password (Brad&rsquo;s choice,
          2026-08-14). That arrives with the Supabase phase, together with
          roles — who can edit campaign blueprints versus who can only run
          campaigns for their clients.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip color="#ff7a55">Email + password sign-in · phase 2</Chip>
          <Chip>Roles to define</Chip>
        </div>
      </section>
    </div>
  );
}
