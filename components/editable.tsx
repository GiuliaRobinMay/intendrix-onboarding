"use client";

import { useEffect, useState } from "react";

/** Input that looks like text until focused; commits on blur. */
export function EditableText({
  value,
  onCommit,
  className = "",
  placeholder,
  multiline = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const base =
    "w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 -mx-1.5 transition-colors hover:border-white/10 focus:border-white/25 focus:bg-navy/60 focus:outline-none";

  if (multiline) {
    return (
      <textarea
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        rows={Math.max(2, Math.ceil(draft.length / 90))}
        className={`${base} resize-none ${className}`}
      />
    );
  }
  return (
    <input
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
      <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}
