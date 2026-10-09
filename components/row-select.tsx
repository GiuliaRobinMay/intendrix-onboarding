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
// The frame matters as much as the value. A word with a small arrow
// floating somewhere to its right is three columns of clutter and no
// signal; a bordered box reads as one thing you can change. The arrow
// is ours rather than the browser's, because a native one sits hard
// against the right edge and looks like the border has been cropped.
//
// It lives inside rows whose background is a link, so it swallows the
// click: picking a value must never also navigate away from the list
// you are working down.

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

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
  /** colour for the value, when the value carries a meaning */
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
      <span className="relative block">
        <select
          data-tip={tip}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={tone ? { color: tone } : undefined}
          className={`w-full max-w-full cursor-pointer appearance-none truncate rounded-lg border border-white/15 bg-navy/60 py-1.5 pl-2.5 pr-7 text-[11px] font-semibold transition-colors focus:border-white/40 focus:outline-none hover:border-white/30 ${
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
        <ChevronDown
          size={12}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-mist"
        />
      </span>
      {sub}
    </span>
  );
}
