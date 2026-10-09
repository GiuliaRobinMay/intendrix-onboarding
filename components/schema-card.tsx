"use client";

// Whether the database has caught up with the code.
//
// Migrations here are pasted into the Supabase SQL editor by a person,
// which is fine until the two drift — and then the symptom is never
// "a migration is missing". It is a change that will not save, an
// invitation that will not send, or a nightly engine that dies on a
// column it was taught to ask for and quietly stops every email in the
// system for two days.
//
// So the app says it out loud, before something breaks, and hands over
// exactly the SQL to paste. Nothing here runs anything: this is a
// person's job, on purpose, and the card's whole value is that it
// knows what to ask for.

import { useEffect, useState } from "react";
import { Check, Copy, Database, TriangleAlert } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";

interface Need {
  migration: string;
  table: string;
  column: string | null;
  cost: string;
}

export function SchemaCard() {
  const [state, setState] = useState<
    { loading: true } | { loading: false; missing: Need[]; sql: string }
  >({ loading: true });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/schema-check", {
          headers: await authHeaders(),
        });
        const out = await res.json();
        if (alive && Array.isArray(out.missing))
          setState({ loading: false, missing: out.missing, sql: out.sql ?? "" });
      } catch {
        /* the database has its own banner when it cannot be reached */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) return null;

  const copy = () => {
    navigator.clipboard?.writeText(state.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!state.missing.length)
    return (
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Database size={16} className="text-mist" /> Database
        </h2>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#4ade80]">
          <Check size={13} /> Up to date with the app.
        </p>
      </section>
    );

  return (
    <section className="card border-[#eb320f]/50 p-5 xl:col-span-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-[#ff7a55]">
        <TriangleAlert size={16} /> The database is{" "}
        {state.missing.length === 1 ? "one update" : `${state.missing.length} updates`}{" "}
        behind
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-mist">
        The app is asking for things that are not there yet. Copy the SQL below,
        paste it into the Supabase SQL editor and run it — all of it is safe to
        run twice.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {state.missing.map((m) => (
          <li
            key={m.migration}
            className="rounded-lg border border-white/10 bg-navy/40 p-2.5"
          >
            <p className="font-mono text-[11px] text-paper">
              {m.column ? `${m.table}.${m.column}` : `table ${m.table}`}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-mist">{m.cost}</p>
          </li>
        ))}
      </ul>

      <button
        onClick={copy}
        className="brand-gradient mt-3 flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied — paste it into Supabase" : "Copy the SQL"}
      </button>

      <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/10 bg-navy/60 p-3 font-mono text-[10px] leading-relaxed text-mist">
        {state.sql}
      </pre>
    </section>
  );
}
