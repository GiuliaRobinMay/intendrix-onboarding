"use client";

// A dropdown that reads as plain text in a table row until you reach
// for it. Lists are for scanning first and fixing second, so a column
// of boxed form controls costs more than it gives — but having to open
// nine campaigns to correct nine senders costs more still.
//
// It lives inside rows whose background is a link, so it swallows the
// click: picking a value must never also navigate away from the list
// you are working down.

import type { ReactNode } from "react";

export function RowSelect({
  value,
  onChange,
  options,
  tip,
  placeholder = "Unassigned",
  tone,
  sub,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  tip?: string;
  placeholder?: string;
  /** colour for the chosen value, when the value carries a meaning */
  tone?: string;
  /** a quieter second line, such as the address behind a name */
  sub?: ReactNode;
}) {
  const empty = value === "";
  return (
    <span
      className="block min-w-0"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <select
        data-tip={tip}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={tone && !empty ? { color: tone } : undefined}
        className={`-ml-1 w-full max-w-full cursor-pointer truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold focus:border-white/30 focus:outline-none hover:border-white/20 hover:bg-navy/60 ${
          empty ? "text-mist/60 italic" : "text-paper"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {sub}
    </span>
  );
}
