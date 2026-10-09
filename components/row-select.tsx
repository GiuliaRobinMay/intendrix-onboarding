"use client";

// A dropdown in a table row.
//
// It used to render differently depending on where the value came
// from — dimmed italic for inherited or derived, solid for chosen by
// hand — which meant a column of Actives in two colours and a column
// of names in two styles. The distinction is real but nobody asked for
// it, and a list that needs a legend is a worse list. One appearance:
// a value looks like a value.
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
        style={tone ? { color: tone } : undefined}
        className={`w-full max-w-full cursor-pointer truncate rounded-md border border-white/12 bg-navy/50 px-1.5 py-1 text-[11px] font-semibold focus:border-white/40 focus:outline-none hover:border-white/30 ${
          empty ? "text-mist" : "text-paper"
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
