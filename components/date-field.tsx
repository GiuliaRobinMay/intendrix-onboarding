"use client";

// A date box that always reads mm/dd/yyyy.
//
// A native date input writes the date in the locale of the browser it is
// opened in, so the same lesson showed 07/10/2026 to one person and
// 10/07/2026 to another. Phoenix works in the United States and the date
// has to say the same thing on every screen, so the text here is ours.
//
// The native control is still underneath — invisible, the full size of
// the box — because it brings the calendar, the keyboard handling and
// the mobile behaviour with it. Clicking opens that calendar.

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { usDate } from "@/lib/dates";

export function DateField({
  value,
  onChange,
  className,
  tip,
  icon = true,
  placeholder = "mm/dd/yyyy",
  style,
  disabled,
}: {
  /** "" or an ISO day, yyyy-mm-dd */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  tip?: string;
  icon?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // showPicker() is the only way to open the calendar from a click
  // anywhere in the box; a browser without it still focuses the field so
  // the date can be typed.
  const openPicker = () => {
    try {
      ref.current?.showPicker();
    } catch {
      ref.current?.focus();
    }
  };

  return (
    <span
      data-tip={tip}
      style={style}
      className={`relative inline-flex items-center justify-center gap-1 tabular-nums ${
        disabled ? "" : "cursor-pointer"
      } ${className ?? ""}`}
    >
      <span className={value ? "" : "opacity-50"}>
        {value ? usDate(value) : placeholder}
      </span>
      {icon && <CalendarDays size={11} className="shrink-0 opacity-60" />}
      <input
        ref={ref}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          e.stopPropagation();
          openPicker();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      />
    </span>
  );
}
