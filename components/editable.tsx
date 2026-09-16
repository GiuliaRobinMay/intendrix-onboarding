"use client";

import { useEffect, useState } from "react";

/** An input that reads as text but always wears its frame, so you can
 *  see at a glance where something can be typed; commits on blur. */
export function EditableText({
  value,
  onCommit,
  className = "",
  placeholder,
  multiline = false,
  minRows,
  invalid = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  /** never shrink below this many lines (multiline only) */
  minRows?: number;
  /** something important is missing here — say so in red */
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const base = invalid
    ? "w-full rounded-md border border-[#eb320f]/70 bg-[#eb320f]/8 px-2 py-1 transition-colors hover:border-[#ff7a55] focus:border-[#ff7a55] focus:outline-none"
    : "w-full rounded-md border border-white/12 bg-navy/40 px-2 py-1 transition-colors hover:border-white/25 focus:border-white/40 focus:bg-navy/70 focus:outline-none";

  if (multiline) {
    return (
      <textarea
        title="Click to edit — saves when you click away"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        rows={Math.max(
          minRows ?? 2,
          draft.split("\n").length + 1,
          Math.ceil(draft.length / 90)
        )}
        className={`${base} resize-none ${className}`}
      />
    );
  }
  return (
    <input
      title="Click to edit — saves when you click away"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      className={`${base} ${className}`}
    />
  );
}

/** Small labelled input for forms. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-mist">
        {label}
      </span>
      <input
        title={placeholder ?? label}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/10 bg-navy/60 px-2.5 py-1.5 text-[13px] focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}
