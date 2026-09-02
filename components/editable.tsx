"use client";

import { useEffect, useState } from "react";

/** Input that looks like text until focused; commits on blur. */
export function EditableText({
  value,
  onCommit,
  className = "",
  placeholder,
  multiline = false,
  minRows,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  /** never shrink below this many lines (multiline only) */
  minRows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const base =
    "w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 -mx-1.5 transition-colors hover:border-white/10 focus:border-white/25 focus:bg-navy/60 focus:outline-none";

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
