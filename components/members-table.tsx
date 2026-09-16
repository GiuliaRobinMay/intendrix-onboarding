"use client";

// The client's people, in full. This is where the account is actually
// managed: who receives which series, whether they accepted the user
// agreement, whether they are in the community, whether their address
// still works, what the team needs to remember about them, and whether
// they are still on the team at all.
//
// Nobody is deleted for leaving: they become inactive, keep their whole
// history, and every send skips them from that moment on.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CircleCheck,
  CircleDashed,
  Crown,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { EditableText, Field } from "@/components/editable";
import { GradientButton, GhostButton } from "@/components/ui";
import { OnboardingChips, OnboardingLegend } from "@/components/onboarding";
import { useConfirm } from "@/components/confirm";
import { useData } from "@/lib/state";
import { fmtDate } from "@/lib/store";
import type { Client, Member, MemberRole, MemberStatus } from "@/lib/types";

/** what the send log + the provider say about one email to one person */
const HISTORY_LABEL: Record<string, { text: string; color: string }> = {
  clicked: { text: "clicked", color: "var(--tone-green)" },
  opened: { text: "opened", color: "var(--tone-green)" },
  delivered: { text: "delivered", color: "var(--color-mist)" },
  delivery_delayed: { text: "delayed", color: "var(--tone-yellow)" },
  bounced: { text: "bounced", color: "#ff7a55" },
  complained: { text: "marked as spam", color: "#ff7a55" },
  failed: { text: "failed", color: "#ff7a55" },
  held: { text: "held", color: "var(--tone-yellow)" },
  sent: { text: "sent", color: "var(--color-mist)" },
};

export function AddMemberForm({
  clientId,
  existing,
  onClose,
}: {
  clientId: string;
  /** who is already on this client — nobody gets a second record */
  existing: Member[];
  onClose: () => void;
}) {
  const { dispatch } = useData();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("participant");
  const [clash, setClash] = useState<string | null>(null);

  return (
    <div className="mb-4 rounded-md border border-white/10 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="First name" value={firstName} onChange={setFirstName} placeholder="" />
        <Field label="Last name" value={lastName} onChange={setLastName} placeholder="" />
        <Field label="Title" value={title} onChange={setTitle} placeholder="" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="" type="email" />
        <label className="block">
          <span className="text-[11px] font-medium text-mist">Series</span>
          <select
            title="Which series this member receives"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="mt-1 w-full rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-[13px] focus:border-white/30 focus:outline-none"
          >
            <option value="participant">Participant series</option>
            <option value="leader">Leader series (CEO)</option>
            <option value="coach">Coach (copy of every send)</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <GradientButton
          onClick={() => {
            const first = firstName.trim();
            const last = lastName.trim();
            if (!first && !last) return;
            const address = email.trim();
            const fullName = [first, last].filter(Boolean).join(" ");
            // one record per person: a second one drifts, and the stale
            // address goes on being used somewhere
            const already = existing.find(
              (m) =>
                (address && m.email && m.email.toLowerCase() === address.toLowerCase()) ||
                m.name.trim().toLowerCase() === fullName.toLowerCase()
            );
            if (already) {
              setClash(
                `${already.name} is already on this client${
                  already.email ? ` (${already.email})` : ""
                } — edit that row instead of adding a second record.`
              );
              return;
            }
            dispatch({
              type: "addMember",
              clientId,
              name: fullName,
              firstName: first,
              lastName: last,
              title,
              email: address,
              role,
            });
            onClose();
          }}
        >
          Add member
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
      {clash && (
        <p className="mt-2 text-[11px] font-semibold text-[#ff7a55]">{clash}</p>
      )}
    </div>
  );
}

const COLS =
  "grid-cols-[minmax(9rem,1.3fr)_minmax(11rem,1.5fr)_7.5rem_6.5rem_4.5rem_minmax(7rem,1.3fr)_4.25rem]";

/** the provider's last word, when it was bad news */
function DeliveryFlag({ member }: { member: Member }) {
  if (!member.delivery) return null;
  const label = HISTORY_LABEL[member.delivery.event] ?? {
    text: member.delivery.event,
    color: "#ff7a55",
  };
  const when = member.delivery.at ? ` on ${fmtDate(new Date(member.delivery.at))}` : "";
  return (
    <span
      data-tip={`The last email to this address ${label.text}${when}. ${
        member.delivery.error ? member.delivery.error : "Check the address with them."
      }`}
      className="flex shrink-0 items-center gap-1 rounded bg-[#eb320f]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#ff7a55]"
    >
      <TriangleAlert size={10} /> {label.text}
    </span>
  );
}

export function MembersSection({ client }: { client: Client }) {
  const { dispatch } = useData();
  const confirmDelete = useConfirm();
  const [adding, setAdding] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = (m: Member) =>
    q
      ? `${m.name} ${m.email} ${m.title ?? ""} ${m.note ?? ""}`.toLowerCase().includes(q)
      : true;
  const byName = (x: Member, y: Member) => x.name.localeCompare(y.name);
  const shown = client.members.filter(matches);
  const active = shown.filter((m) => m.status !== "inactive").sort(byName);
  const gone = shown.filter((m) => m.status === "inactive").sort(byName);
  const troubled = active.filter((m) => m.delivery).length;

  // the same person twice: their records drift apart, and the older
  // address quietly keeps being used by whatever points at it
  const seen = new Map<string, number>();
  for (const m of client.members) {
    for (const key of [
      m.email ? `e:${m.email.trim().toLowerCase()}` : "",
      `n:${m.name.trim().toLowerCase()}`,
    ].filter(Boolean))
      seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const isDuplicate = (m: Member) =>
    (m.email && (seen.get(`e:${m.email.trim().toLowerCase()}`) ?? 0) > 1) ||
    (seen.get(`n:${m.name.trim().toLowerCase()}`) ?? 0) > 1;
  const duplicates = client.members.filter(isDuplicate).length;

  const patch = (memberId: string, p: Parameters<typeof dispatch>[0] extends never ? never : any) =>
    dispatch({ type: "updateMember", clientId: client.id, memberId, patch: p });

  const row = (m: Member) => {
    const inactive = m.status === "inactive";
    return (
      <div key={m.id} className={inactive ? "opacity-55" : ""}>
        <div
          className={`grid ${COLS} items-center gap-x-3 border-b border-white/5 px-1 py-1.5 transition-colors hover:bg-white/4`}
        >
          {/* who */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold text-mist">
              {m.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                <span className="truncate">{m.name}</span>
                {isDuplicate(m) && (
                  <span
                    data-tip="This person appears twice on this client. Two records drift apart — keep the right one, move any campaign assignment to it, and remove the other."
                    className="shrink-0 rounded bg-[#facc15]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#facc15]"
                  >
                    DUPLICATE
                  </span>
                )}
                {m.role === "leader" && (
                  <span
                    data-tip="Receives the Leader series, with the Leaders Guides"
                    className="shrink-0"
                  >
                    <Crown size={11} className="text-[#ff7a55]" />
                  </span>
                )}
              </p>
              {(m.title || inactive) && (
                <p className="truncate text-[11px] text-mist">
                  {inactive
                    ? `Left the team${m.leftAt ? ` · ${fmtDate(new Date(m.leftAt))}` : ""}`
                    : m.title}
                </p>
              )}
            </div>
          </div>

          {/* address, and what the provider last said about it */}
          <div className="flex min-w-0 items-center gap-2">
            <span
              data-tip={m.email || "No email address yet — nothing can be sent to them"}
              className={`min-w-0 truncate text-xs ${
                m.email ? "text-mist" : "font-semibold text-[#ff7a55]"
              }`}
            >
              {m.email || "no email"}
            </span>
            <DeliveryFlag member={m} />
          </div>

          {/* which series */}
          <select
            data-tip="Which series they receive — Leader gets the Leaders Guides, Coach gets a copy of every send"
            value={m.role}
            onChange={(e) => patch(m.id, { role: e.target.value as MemberRole })}
            className="min-w-0 cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-medium text-mist/80 transition-colors hover:border-white/15 hover:bg-navy/60 focus:border-white/30 focus:outline-none"
          >
            <option value="participant">Participant</option>
            <option value="leader">Leader series</option>
            <option value="coach">Coach</option>
          </select>

          {/* on the team, or not anymore */}
          <select
            data-tip="Inactive keeps everything on record but stops every email to them, in every campaign"
            value={m.status ?? "active"}
            onChange={(e) => patch(m.id, { status: e.target.value as MemberStatus })}
            className={`min-w-0 cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-semibold transition-colors hover:border-white/15 hover:bg-navy/60 focus:border-white/30 focus:outline-none ${
              inactive ? "text-[#ff7a55]" : "text-[#4ade80]"
            }`}
          >
            <option value="active">Active</option>
            <option value="inactive">Left</option>
          </select>

          {/* agreement + community */}
          <OnboardingChips member={m} />

          {/* whatever the team needs to remember */}
          <EditableText
            value={m.note ?? ""}
            placeholder="Add a note…"
            onCommit={(v) => patch(m.id, { note: v.trim() })}
            className="min-w-0 truncate text-[11px] text-mist"
          />

          <div className="flex items-center justify-end gap-0.5">
            <button
              data-tip="Edit their details"
              onClick={() => setOpenInfo(openInfo === m.id ? null : m.id)}
              className={`shrink-0 cursor-pointer rounded-md p-1 transition-colors ${
                openInfo === m.id
                  ? "bg-white/10 text-paper"
                  : "text-mist hover:bg-white/8 hover:text-paper"
              }`}
            >
              <Pencil size={13} />
            </button>
            <Link
              href={`/members/${m.id}`}
              data-tip="Every email they were sent — delivered, opened, or bounced"
              className="shrink-0 cursor-pointer rounded-md p-1 text-mist transition-colors hover:bg-white/8 hover:text-paper"
            >
              <Mail size={13} />
            </Link>
            <button
              data-tip="Remove this member — for someone who left, Left is the better choice"
              onClick={async () => {
                if (
                  await confirmDelete({
                    name: m.name,
                    detail: `Deletes them from ${client.shortName} entirely. To stop their emails while keeping the record, set them to Left instead.`,
                    verb: "Remove",
                  })
                )
                  dispatch({ type: "removeMember", clientId: client.id, memberId: m.id });
              }}
              className="shrink-0 cursor-pointer rounded-md p-1 text-mist hover:bg-[#eb320f]/20 hover:text-[#ff7a55]"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {openInfo === m.id && (
          <div className="mx-1 mb-3 max-w-4xl rounded-lg border border-white/15 bg-white/6 px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
              <p className="text-xs font-bold">{m.name}</p>
              <button
                data-tip="Close"
                onClick={() => setOpenInfo(null)}
                className="cursor-pointer rounded-md p-1 text-mist transition-colors hover:bg-white/10 hover:text-paper"
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-medium text-mist">First name</span>
                <EditableText
                  value={m.firstName ?? ""}
                  placeholder="First"
                  onCommit={(v) => patch(m.id, { firstName: v.trim() })}
                  className="text-xs font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-mist">Last name</span>
                <EditableText
                  value={m.lastName ?? ""}
                  placeholder="Last"
                  onCommit={(v) => patch(m.id, { lastName: v.trim() })}
                  className="text-xs font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-mist">Title</span>
                <EditableText
                  value={m.title ?? ""}
                  placeholder="Title"
                  onCommit={(v) => patch(m.id, { title: v.trim() })}
                  className="text-xs"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-mist">Email</span>
                <EditableText
                  value={m.email}
                  placeholder="email@company.com"
                  onCommit={(v) => v.includes("@") && patch(m.id, { email: v.trim() })}
                  className="text-xs"
                />
              </label>
              <div className="sm:col-span-2">
                <p className="mb-1 text-[10px] font-medium text-mist">Onboarding</p>
                <p className="text-xs leading-relaxed text-mist">
                  {m.agreementSignedAt
                    ? `Accepted the user agreement on ${fmtDate(new Date(m.agreementSignedAt))}.`
                    : m.agreementSentAt
                      ? `The user agreement was sent ${fmtDate(new Date(m.agreementSentAt))} — not accepted yet.`
                      : "The user agreement has not been sent to them yet."}{" "}
                  {m.communityJoinedAt
                    ? "In the community."
                    : m.communityInvitedAt
                      ? "Invited into the community — has not joined yet."
                      : "Not invited into the community yet."}
                  <button
                    data-tip={
                      m.communityJoinedAt
                        ? "They are marked as in the community — undo if that is wrong"
                        : "Joined on their own? Record it here so they are not invited again"
                    }
                    onClick={() =>
                      dispatch({
                        type: "setMemberJoined",
                        clientId: client.id,
                        memberId: m.id,
                        joined: !m.communityJoinedAt,
                      })
                    }
                    className="ml-2 cursor-pointer rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
                  >
                    {m.communityJoinedAt ? "Mark as not joined" : "Mark as joined"}
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="card mt-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex flex-wrap items-baseline gap-x-3 text-base font-bold">
          Members
          <span className="text-xs font-medium text-mist">
            {client.members.filter((m) => m.status !== "inactive").length} on the team
            {client.members.some((m) => m.status === "inactive")
              ? ` · ${client.members.filter((m) => m.status === "inactive").length} left`
              : ""}
            {troubled ? ` · ${troubled} with a bad address` : ""}
            {duplicates ? ` · ${duplicates} duplicated` : ""}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={12}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-mist"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              title="Find a person by name, email, title or note"
              className="w-40 rounded-md border border-white/10 bg-navy/60 py-1 pl-6.5 pr-2 text-xs focus:w-56 focus:border-white/30 focus:outline-none"
            />
          </div>
          <button
            data-tip="Add a member to this client"
            onClick={() => setAdding(true)}
            className="cursor-pointer rounded-md border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {client.members.length > 0 && (
        <div className="mb-3">
          <OnboardingLegend />
        </div>
      )}

      {adding && (
        <AddMemberForm
          clientId={client.id}
          existing={client.members}
          onClose={() => setAdding(false)}
        />
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[58rem]">
          <div
            className={`grid ${COLS} gap-x-3 border-b border-white/8 px-1 pb-1.5 text-[11px] font-medium text-mist`}
          >
            <span>Name</span>
            <span>Email</span>
            <span>Series</span>
            <span>On the team</span>
            <span>Onboarding</span>
            <span>Note</span>
            <span />
          </div>

          <div className="flex max-h-[38rem] flex-col overflow-y-auto pr-1">
            {active.map(row)}

            {gone.length > 0 && (
              <p className="mt-4 mb-1 px-1 text-[11px] font-semibold text-mist/60">
                No longer on the team — kept on record, never emailed
              </p>
            )}
            {gone.map(row)}

            {client.members.length === 0 && (
              <p className="py-6 text-sm text-mist">
                No members yet — add the team with the + button.
              </p>
            )}
            {client.members.length > 0 && shown.length === 0 && (
              <p className="py-6 text-sm text-mist">
                Nobody matches &ldquo;{query.trim()}&rdquo;.{" "}
                <button
                  onClick={() => setQuery("")}
                  className="cursor-pointer font-semibold underline hover:text-paper"
                >
                  Clear the search
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-white/5 pt-4 text-xs leading-relaxed text-mist">
        <p className="flex items-center gap-1.5">
          <CircleCheck size={13} className="text-[#4ade80]" />
          Leader receives the Leader series (with Leaders Guides).
        </p>
        <p className="flex items-center gap-1.5">
          <CircleDashed size={13} />
          Coaches receive a copy of every send.
        </p>
        <p className="flex items-center gap-1.5">
          <TriangleAlert size={13} className="text-[#ff7a55]" />
          A flagged address stopped accepting mail — fix it or set them to Left.
        </p>
      </div>
    </section>
  );
}
