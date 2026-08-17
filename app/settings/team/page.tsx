"use client";

import { useState } from "react";
import { Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Chip, GhostButton, GradientButton } from "@/components/ui";
import { Field } from "@/components/editable";
import { team } from "@/lib/data";
import { useData } from "@/lib/state";
import type { AppRole } from "@/lib/types";

const ROLE_LABEL: Record<AppRole, string> = {
  phoenix_admin: "Phoenix team",
  client_admin: "Client admin",
};

const ROLE_TIP: Record<AppRole, string> = {
  phoenix_admin: "Full access — sees and edits everything",
  client_admin: "Sees only their own company and its campaigns",
};

function InviteForm({ onClose }: { onClose: () => void }) {
  const { clients, dispatch } = useData();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("phoenix_admin");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");

  const valid =
    email.includes("@") && (role === "phoenix_admin" || clientId !== "");

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/3 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Email address"
          value={email}
          onChange={setEmail}
          placeholder="name@company.com"
          type="email"
        />
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
            Access
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="mt-1 w-full cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
          >
            <option value="phoenix_admin">Phoenix team — full access</option>
            <option value="client_admin">
              Client admin — sees only their company
            </option>
          </select>
        </label>
      </div>

      {role === "client_admin" && (
        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
            Their company
          </span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 w-full cursor-pointer rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-[11px] text-mist">
            A client admin sees only this company and its campaigns — nothing
            else in the app.
          </span>
        </label>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-mist">
        The invitation email lets them sign in with their email address and set
        their own password. In the prototype the invite is recorded below; real
        emails go out once the app runs on Supabase.
      </p>

      <div className="mt-4 flex gap-2">
        <GradientButton
          tip={valid ? undefined : "Enter an email address first"}
          onClick={() => {
            if (!valid) return;
            dispatch({
              type: "addInvitation",
              email: email.trim(),
              role,
              clientId: role === "client_admin" ? clientId : undefined,
            });
            setEmail("");
            onClose();
          }}
        >
          Send invitation
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}

export default function TeamSettingsPage() {
  const { clients, invitations, dispatch } = useData();
  const [inviting, setInviting] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Users</h2>
            <GhostButton
              tip="Invite someone — they set their own password"
              onClick={() => setInviting((v) => !v)}
            >
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
                <Chip>Phoenix team</Chip>
              </li>
            ))}
          </ul>

          {inviting && <InviteForm onClose={() => setInviting(false)} />}
        </section>

        <section className="card p-6">
          <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
            <Mail size={16} className="text-mist" /> Pending invitations
          </h2>
          <p className="mb-4 text-xs text-mist">
            Waiting for the person to accept and set their password.
          </p>

          {invitations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-mist">
              No pending invitations.
            </p>
          ) : (
            <ul className="flex flex-col">
              {invitations.map((inv) => {
                const client = clients.find((c) => c.id === inv.clientId);
                return (
                  <li
                    key={inv.id}
                    className="group flex items-center gap-3 border-b border-white/6 px-2 py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{inv.email}</p>
                      {client && (
                        <p className="truncate text-xs text-mist">{client.name}</p>
                      )}
                    </div>
                    <span data-tip={ROLE_TIP[inv.role]}>
                      <Chip
                        color={inv.role === "client_admin" ? "#ff7a55" : undefined}
                      >
                        {ROLE_LABEL[inv.role]}
                      </Chip>
                    </span>
                    <button
                      data-tip="Withdraw this invitation"
                      onClick={() =>
                        dispatch({ type: "removeInvitation", invitationId: inv.id })
                      }
                      className="cursor-pointer rounded-lg p-1.5 text-mist opacity-0 transition-opacity hover:bg-white/5 hover:text-[#ff7a55] group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card self-start p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <ShieldCheck size={17} className="text-mist" /> Sign-in &amp; roles
        </h2>
        <p className="text-sm leading-relaxed text-mist">
          Everyone signs in with their email address and a password they choose
          themselves (Brad&rsquo;s choice, 2026-08-14). Access only comes
          through an invitation sent from this page.
        </p>
        <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-mist">
          <li>
            <span className="font-semibold text-paper">Phoenix team</span> —
            full access to every client, campaign and blueprint.
          </li>
          <li>
            <span className="font-semibold text-paper">Client admin</span> —
            for a person at a client company who runs certain campaigns. They
            see only their own company and its campaigns; the lesson library is
            read-only for them.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip color="#4ade80">Enforced in the database (Supabase RLS)</Chip>
          <Chip>Invite emails · Supabase phase</Chip>
        </div>
      </section>
    </div>
  );
}
