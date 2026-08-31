"use client";

// Picking one person out of thirty-five is a search, not a scroll. This
// replaces the native dropdown wherever a client member is chosen: click
// it, type a few letters of a name, title or location, pick the match.
// Always sorted A–Z.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Member } from "@/lib/types";

export function MemberPicker({
  members,
  value,
  onPick,
  tip,
  excludeIds,
}: {
  members: Member[];
  /** id of the currently chosen member */
  value: string;
  onPick: (memberId: string) => void;
  tip?: string;
  /** people already picked elsewhere — kept out of the list */
  excludeIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const current = members.find((m) => m.id === value);
  const needle = q.trim().toLowerCase();
  const list = [...members]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((m) => m.id === value || !excludeIds?.includes(m.id))
    .filter(
      (m) =>
        !needle ||
        `${m.name} ${m.title ?? ""} ${m.email}`.toLowerCase().includes(needle)
    );

  useEffect(() => {
    if (open) {
      setQ("");
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="relative min-w-0">
      <button
        data-tip={tip}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded border border-transparent px-1 py-1 text-left text-xs font-semibold transition-colors hover:border-white/15 hover:bg-navy/60 focus:border-white/30 focus:outline-none"
      >
        <span className="min-w-0 flex-1 truncate">
          {current
            ? `${current.name}${current.title ? ` — ${current.title}` : ""}`
            : "— pick a person —"}
        </span>
        <ChevronDown size={12} className="shrink-0 text-mist" />
      </button>

      {open && (
        <>
          {/* click anywhere else to close */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 w-full min-w-72 rounded-md border border-white/12 bg-panel shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 border-b border-white/8 px-2.5 py-2">
              <Search size={12} className="shrink-0 text-mist" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && list.length > 0) {
                    onPick(list[0].id);
                    setOpen(false);
                  }
                }}
                placeholder="Type a name, title or location…"
                className="w-full bg-transparent text-xs focus:outline-none"
              />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {list.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      onPick(m.id);
                      setOpen(false);
                    }}
                    className={`w-full cursor-pointer px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-white/6 ${
                      m.id === value ? "bg-white/4 font-semibold" : ""
                    }`}
                  >
                    {m.name}
                    {m.title && (
                      <span className="text-mist"> — {m.title}</span>
                    )}
                  </button>
                </li>
              ))}
              {list.length === 0 && (
                <li className="px-2.5 py-2 text-xs text-mist">
                  Nobody matches &ldquo;{q}&rdquo;.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
