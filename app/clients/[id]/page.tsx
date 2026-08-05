"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Video,
  MapPin,
  CircleCheck,
  CircleDashed,
  Plus,
  X,
} from "lucide-react";
import {
  PageHeader,
  StatusChip,
  Chip,
  ProgressBar,
  GradientButton,
  GhostButton,
} from "@/components/ui";
import { Field } from "@/components/editable";
import { useData } from "@/lib/state";
import { findTemplate, seriesProgress, fmtDate } from "@/lib/store";
import type { MemberRole } from "@/lib/types";

function AddMemberForm({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { dispatch } = useData();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("participant");

  return (
    <div className="mb-4 rounded-xl border border-white/10 p-4">
      <div className="grid gap-3">
        <Field label="Name" value={name} onChange={setName} placeholder="Full name" />
        <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. COO" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="name@org.com" type="email" />
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
            Series
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
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
            if (!name.trim()) return;
            dispatch({ type: "addMember", clientId, name: name.trim(), title, email, role });
            onClose();
          }}
        >
          Add member
        </GradientButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { clients, templates, dispatch } = useData();
  const [addingMember, setAddingMember] = useState(false);
  const [pickingModule, setPickingModule] = useState(false);

  const client = clients.find((c) => c.id === id);
  const today = new Date();

  if (!client) {
    return (
      <div className="card p-10 text-center text-sm text-mist">
        Client not found.{" "}
        <Link href="/clients" className="font-semibold text-paper underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const program = client.programs[0];
  const unloaded = templates.filter((t) => !program?.seriesIds.includes(t.id));

  return (
    <>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> All clients
      </Link>

      <PageHeader
        title={client.name}
        subtitle={`${client.sector} · ${client.location}`}
        action={<StatusChip status={client.status} />}
      />

      {!program ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-mist">
            No program yet for this client. Load the module library to create the
            TLE-E trajectory — you can adapt every series afterwards.
          </p>
          <div className="mt-4 flex justify-center">
            <GradientButton
              onClick={() =>
                dispatch({
                  type: "loadModules",
                  clientId: client.id,
                  templateIds: templates.map((t) => t.id),
                })
              }
            >
              Load all modules (TLE-E)
            </GradientButton>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Sessions + series — main column */}
          <div className="flex flex-col gap-6 xl:col-span-2">
            {/* Session dates */}
            <section className="card p-6">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <CalendarDays size={17} className="text-mist" /> Session dates
                </h2>
                <Chip color="#a3a4f0">{program.code}</Chip>
              </div>
              <p className="mb-5 text-xs text-mist">
                Entering a session date schedules the series that follows it.
                Timezone: {program.timezone}.
              </p>
              <ol className="grid gap-3 md:grid-cols-5">
                {program.sessions.map((session, i) => {
                  const date = session.date ? new Date(`${session.date}T00:00:00`) : null;
                  const past = date !== null && date < today;
                  return (
                    <li key={session.key} className="card p-3.5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-mist">
                        Session {i + 1}
                      </p>
                      <p className="mt-1 min-h-8 text-xs font-semibold leading-tight">
                        {session.name}
                      </p>
                      <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-mist">
                        {session.mode === "virtual" ? (
                          <>
                            <Video size={11} /> virtual
                          </>
                        ) : (
                          <>
                            <MapPin size={11} /> in person
                          </>
                        )}
                      </p>
                      <input
                        type="date"
                        value={session.date ?? ""}
                        onChange={(e) =>
                          dispatch({
                            type: "setSessionDate",
                            clientId: client.id,
                            programId: program.id,
                            sessionKey: session.key,
                            date: e.target.value || null,
                          })
                        }
                        className={`mt-3 w-full cursor-pointer rounded-lg border px-1 py-1.5 text-center text-xs font-bold tabular-nums focus:outline-none ${
                          date
                            ? past
                              ? "border-transparent bg-white/8 text-paper"
                              : "brand-gradient-soft border-transparent text-paper"
                            : "border-dashed border-white/15 text-mist/70"
                        }`}
                      />
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* Loaded series */}
            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold">Loaded series</h2>
                {unloaded.length > 0 && (
                  <GhostButton onClick={() => setPickingModule((v) => !v)}>
                    + Load another module
                  </GhostButton>
                )}
              </div>

              {pickingModule && unloaded.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-white/10 p-3">
                  {unloaded.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        dispatch({
                          type: "loadModules",
                          clientId: client.id,
                          templateIds: [t.id],
                        });
                        setPickingModule(false);
                      }}
                      className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-paper transition-transform hover:scale-105"
                      style={{ backgroundColor: t.color }}
                    >
                      + {t.code} · {t.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {program.seriesIds.map((sid) => {
                  const series = findTemplate(templates, sid);
                  if (!series) return null;
                  const p = seriesProgress(program, series, today);
                  return (
                    <div key={sid} className="card card-hover group relative">
                      <Link href={`/modules/${sid}`} className="flex items-center gap-4 p-4">
                        <div
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-paper"
                          style={{ backgroundColor: series.color }}
                        >
                          {series.code}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">
                            {series.name}
                            <span className="ml-2 font-medium text-mist">· {series.focus}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-mist">
                            Triggered by {series.triggerLabel} ·{" "}
                            {p.scheduled
                              ? p.next
                                ? `next send ${fmtDate(p.next.date!)}`
                                : "all sent"
                              : "awaiting session date"}
                          </p>
                          <div className="mt-2 max-w-72">
                            <ProgressBar
                              pct={p.total ? (p.sent / p.total) * 100 : 0}
                              color={series.color}
                            />
                          </div>
                        </div>
                        <div className="shrink-0 pr-6 text-right">
                          <p className="text-sm font-bold tabular-nums">
                            {p.sent}/{p.total}
                          </p>
                          <p className="text-[11px] text-mist">sent</p>
                        </div>
                      </Link>
                      <button
                        title="Unload this series from the client"
                        onClick={() =>
                          dispatch({
                            type: "unloadModule",
                            clientId: client.id,
                            templateId: sid,
                          })
                        }
                        className="absolute right-3 top-3 hidden cursor-pointer rounded-lg p-1 text-mist hover:bg-white/10 hover:text-paper group-hover:block"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Members */}
          <section className="card self-start p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Members</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-mist">
                  {client.members.length}
                </span>
                <button
                  onClick={() => setAddingMember(true)}
                  className="cursor-pointer rounded-lg border border-white/10 p-1.5 text-mist transition-colors hover:border-white/25 hover:text-paper"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {addingMember && (
              <AddMemberForm clientId={client.id} onClose={() => setAddingMember(false)} />
            )}

            <ul className="flex max-h-130 flex-col gap-1 overflow-y-auto pr-1">
              {client.members.map((m) => (
                <li
                  key={m.id}
                  className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/4"
                >
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      m.role === "leader" ? "brand-gradient" : "bg-white/8 text-mist"
                    }`}
                  >
                    {m.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {m.name}
                      {m.role === "leader" && (
                        <Crown size={12} className="shrink-0 text-[#ff7a55]" />
                      )}
                    </p>
                    <p className="truncate text-[11px] text-mist">{m.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-mist/70 group-hover:hidden">
                    {m.role === "leader"
                      ? "Leader series"
                      : m.role === "coach"
                        ? "Coach"
                        : "Participant"}
                  </span>
                  <button
                    onClick={() =>
                      dispatch({ type: "removeMember", clientId: client.id, memberId: m.id })
                    }
                    className="hidden shrink-0 cursor-pointer rounded-lg p-1 text-mist hover:bg-white/10 hover:text-paper group-hover:block"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
              {client.members.length === 0 && (
                <li className="py-4 text-sm text-mist">
                  No members yet — add the team with the + button.
                </li>
              )}
            </ul>
            <div className="mt-4 border-t border-white/5 pt-4 text-xs leading-relaxed text-mist">
              <p className="flex items-center gap-1.5">
                <CircleCheck size={13} className="text-[#4ade80]" />
                Leader receives the Leader series (with Leaders Guides).
              </p>
              <p className="mt-1.5 flex items-center gap-1.5">
                <CircleDashed size={13} />
                Coaches receive a copy of every send.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
