"use client";

import { useState } from "react";
import { Mail, Send, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Chip, GhostButton, GradientButton } from "@/components/ui";
import { EditableText, Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { authHeaders } from "@/lib/supabase-browser";
import type { StaffMember } from "@/lib/types";

const ACCESS: Record<string, { label: string; color?: string; tip: string }> = {
  active: {
    label: "Signed up",
    color: "#4ade80",
    tip: "Has an account and can sign in",
  },
  invited: {
    label: "Invited",
    color: "#facc15",
    tip: "Invitation sent — waiting for them to set their password",
  },
  none: {
    label: "No access yet",
    tip: "On the team and assignable, but cannot sign in until invited",
  },
};

/** Send the invitation email; the row itself is written by the action. */
async function sendInviteEmail(email: string): Promise<string> {
  try {
    const auth = await authHeaders();
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "content-type": "application/json", ...auth },
      body: JSON.stringify({ email }),
    });
    const out = await res.json();
    return out.sent
      ? `Invitation email sent to ${email}.`
      : `Invitation recorded — no email went out (${out.reason ?? "sending unavailable"}).`;
  } catch {
    return "Invitation recorded — the email could not be sent.";
  }
}

const selectCls =
  "mt-1 w-full cursor-pointer rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-[13px] focus:border-white/30 focus:outline-none";

/** Add a Phoenix colleague: one form creates the team member AND their
 *  invitation, so the person you assign is the person who signs in. */
function AddColleagueForm({
  onClose,
  onNotice,
}: {
  onClose: () => void;
  onNotice: (n: string) => void;
}) {
  const { dispatch } = useData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Phoenix Coach");
  const [invite, setInvite] = useState(true);

  const valid = name.trim() !== "" && email.includes("@");

  return (
    <div className="mt-4 rounded-md border border-white/10 bg-white/3 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Name" value={name} onChange={setName} placeholder="Full name" />
        <Field
          label="Work email"
          value={email}
          onChange={setEmail}
          placeholder="name@phoenixperform.com"
          type="email"
        />
        <label className="block">
          <span className="text-[11px] font-medium text-mist">Role</span>
          <select
            title="Their role on the Phoenix team"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={selectCls}
          >
            <option>Phoenix Coach</option>
            <option>Phoenix Leader</option>
            <option>Program Coordinator</option>
            <option>Project Manager</option>
            <option>Community &amp; Platform</option>
          </select>
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={invite}
          onChange={(e) => setInvite(e.target.checked)}
          className="mt-0.5 size-4 cursor-pointer accent-[#eb320f]"
        />
        <span>
          Send them an invitation to sign in
          <span className="block text-[11px] text-mist">
            They choose their own password. Leave this off to add someone who
            should be assignable but not yet have access.
          </span>
        </span>
      </label>

      <p className="mt-3 text-[11px] leading-relaxed text-mist">
        This work email is also the address their campaign emails are sent
        from, so it has to be a real address on the sending domain.
      </p>

      <div className="mt-4 flex gap-2">
        <GradientButton
          tip={valid ? undefined : "A name and an email address are needed"}
          onClick={async () => {
            if (!valid) return;
            const addr = email.trim();
            const staffId = `staff-${Math.random().toString(36).slice(2, 9)}`;
            dispatch({
              type: "addStaff",
              id: staffId,
              name: name.trim(),
              role,
              email: addr,
            });
            if (invite) {
              dispatch({
                type: "addInvitation",
                email: addr,
                role: "phoenix_admin",
                staffId,
              });
            }
            onClose();
            if (invite) onNotice(await sendInviteEmail(addr));
            else onNotice(`${name.trim()} added to the team — not invited yet.`);
          }}
        >
          Add to the team
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}

/** Invite an external person at a client — they are not Phoenix staff, so
 *  they get no team row, only scoped access to their own company. */
function InviteClientAdminForm({
  onClose,
  onNotice,
}: {
  onClose: () => void;
  onNotice: (n: string) => void;
}) {
  const { clients, dispatch } = useData();
  const [email, setEmail] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");

  const valid = email.includes("@") && clientId !== "";

  return (
    <div className="mt-4 rounded-md border border-white/10 bg-white/3 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Email address"
          value={email}
          onChange={setEmail}
          placeholder="name@theircompany.com"
          type="email"
        />
        <label className="block">
          <span className="text-[11px] font-medium text-mist">Their company</span>
          <select
            title="The one company this person may see"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={selectCls}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-mist">
        They see only this company and its campaigns, and the lesson library is
        read-only for them. They are not added to the Phoenix team, so they
        can&rsquo;t be assigned as a coach.
      </p>
      <div className="mt-4 flex gap-2">
        <GradientButton
          tip={valid ? undefined : "An email address is needed"}
          onClick={async () => {
            if (!valid) return;
            const addr = email.trim();
            dispatch({
              type: "addInvitation",
              email: addr,
              role: "client_admin",
              clientId,
            });
            onClose();
            onNotice(await sendInviteEmail(addr));
          }}
        >
          Send invitation
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}

function TeamRow({ person }: { person: StaffMember }) {
  const { dispatch } = useData();
  const [notice, setNotice] = useState<string | null>(null);
  const access = ACCESS[person.access ?? "none"];

  return (
    <li className="group border-b border-white/6 py-2.5 last:border-b-0">
      <div className="grid grid-cols-1 items-center gap-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.45fr)_7rem_4.5rem] lg:gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold text-mist">
            {person.initials}
          </span>
          <EditableText
            value={person.name}
            onCommit={(v) =>
              v.trim() &&
              dispatch({ type: "updateStaff", staffId: person.id, patch: { name: v.trim() } })
            }
            className="text-sm font-semibold"
          />
        </div>

        <EditableText
          value={person.role}
          onCommit={(v) =>
            dispatch({ type: "updateStaff", staffId: person.id, patch: { role: v } })
          }
          className="text-xs text-mist"
        />

        <EditableText
          value={person.email}
          onCommit={(v) =>
            v.includes("@") &&
            dispatch({ type: "updateStaff", staffId: person.id, patch: { email: v.trim() } })
          }
          className="text-xs text-mist"
        />

        <span data-tip={access.tip} className="w-fit">
          <Chip color={access.color}>{access.label}</Chip>
        </span>

        <span className="flex items-center justify-end gap-1">
          {person.access === "none" && (
            <button
              data-tip="Send this person an invitation to sign in"
              onClick={async () => {
                dispatch({
                  type: "addInvitation",
                  email: person.email,
                  role: "phoenix_admin",
                  staffId: person.id,
                });
                setNotice(await sendInviteEmail(person.email));
              }}
              className="cursor-pointer rounded-md border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
            >
              <Send size={13} />
            </button>
          )}
          <button
            data-tip="Remove from the team — they also lose every assignment"
            onClick={() => {
              if (
                confirm(
                  `Remove ${person.name} from the team? They lose their assignments; their sign-in account is removed in Supabase.`
                )
              )
                dispatch({ type: "removeStaff", staffId: person.id });
            }}
            className="cursor-pointer rounded-md p-1.5 text-mist opacity-0 transition-opacity hover:bg-[#eb320f]/20 hover:text-[#ff7a55] group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </span>
      </div>
      {notice && <p className="mt-1.5 pl-11 text-[11px] text-mist">{notice}</p>}
    </li>
  );
}

export default function TeamSettingsPage() {
  const { staff, clients, invitations, dispatch } = useData();
  const [adding, setAdding] = useState(false);
  const [invitingClient, setInvitingClient] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const clientAdmins = invitations.filter((i) => i.role === "client_admin");

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <section className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-bold">The Phoenix team</h2>
            <GhostButton
              tip="Add a colleague and invite them in one step"
              onClick={() => setAdding((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <UserPlus size={14} /> Add colleague
              </span>
            </GhostButton>
          </div>
          <p className="mb-3 text-xs text-mist">
            One list: these are the people who sign in <em>and</em> the people
            you assign to clients and campaigns. Click any name, role or address
            to edit it.
          </p>

          <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.45fr)_7rem_4.5rem] gap-3 border-b border-white/8 pb-1.5 text-[11px] font-medium text-mist lg:grid">
            <span>Name</span>
            <span>Role</span>
            <span>Sends from</span>
            <span>Access</span>
            <span />
          </div>

          <ul className="flex flex-col">
            {staff.map((person) => (
              <TeamRow key={person.id} person={person} />
            ))}
            {staff.length === 0 && (
              <li className="py-4 text-sm text-mist">
                Nobody on the team yet — add your colleagues with the button
                above.
              </li>
            )}
          </ul>

          {adding && (
            <AddColleagueForm onClose={() => setAdding(false)} onNotice={setNotice} />
          )}
          {notice && (
            <p className="mt-3 rounded-md border border-white/10 bg-white/3 px-3 py-2 text-xs text-mist">
              {notice}
            </p>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Mail size={16} className="text-mist" /> Client admins
            </h2>
            <GhostButton
              tip="Give someone at a client access to their own campaigns"
              onClick={() => setInvitingClient((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <UserPlus size={14} /> Invite client admin
              </span>
            </GhostButton>
          </div>
          <p className="mb-3 text-xs text-mist">
            External people who run their own company&rsquo;s campaigns. They
            see nothing else.
          </p>

          {clientAdmins.length === 0 ? (
            <p className="rounded-md border border-dashed border-white/10 px-4 py-5 text-center text-sm text-mist">
              No client admins yet.
            </p>
          ) : (
            <ul className="flex flex-col">
              {clientAdmins.map((inv) => {
                const client = clients.find((c) => c.id === inv.clientId);
                return (
                  <li
                    key={inv.id}
                    className="group flex items-center gap-3 border-b border-white/6 py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{inv.email}</p>
                      {client && (
                        <p className="truncate text-xs text-mist">{client.name}</p>
                      )}
                    </div>
                    <Chip color="#ff7a55">Invited</Chip>
                    <button
                      data-tip="Withdraw this invitation"
                      onClick={() =>
                        dispatch({ type: "removeInvitation", invitationId: inv.id })
                      }
                      className="cursor-pointer rounded-md p-1.5 text-mist opacity-0 transition-opacity hover:bg-white/5 hover:text-[#ff7a55] group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {invitingClient && (
            <InviteClientAdminForm
              onClose={() => setInvitingClient(false)}
              onNotice={setNotice}
            />
          )}
        </section>
      </div>

      <section className="card self-start p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <ShieldCheck size={17} className="text-mist" /> How access works
        </h2>
        <ul className="flex flex-col gap-3 text-sm leading-relaxed text-mist">
          <li>
            <span className="font-semibold text-paper">One list, one person.</span>{" "}
            Adding a colleague here makes them assignable as Leader, Coach or
            Project Manager straight away — and invites them to sign in.
          </li>
          <li>
            <span className="font-semibold text-paper">Their address matters.</span>{" "}
            A colleague&rsquo;s work email is the address the lessons of their
            clients are sent from.
          </li>
          <li>
            <span className="font-semibold text-paper">Assignable without access.</span>{" "}
            Untick the invitation box to add someone who should appear in the
            dropdowns but not log in yet. Invite them later with the send
            button.
          </li>
          <li>
            <span className="font-semibold text-paper">Client admins are guests.</span>{" "}
            They see only their own company and never appear as a coach.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip color="#4ade80">Scoping enforced in the database</Chip>
        </div>
      </section>
    </div>
  );
}
