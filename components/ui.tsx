import type { CSSProperties, ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/8 pb-3.5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mist">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function GradientButton({
  children,
  onClick,
  tip,
}: {
  children: ReactNode;
  onClick?: () => void;
  tip?: string;
}) {
  return (
    <button
      data-tip={tip}
      onClick={onClick}
      className="brand-gradient cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-semibold transition-opacity hover:opacity-90"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  tip,
}: {
  children: ReactNode;
  onClick?: () => void;
  tip?: string;
}) {
  return (
    <button
      data-tip={tip}
      onClick={onClick}
      className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-[13px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
    >
      {children}
    </button>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card relative overflow-hidden px-4 py-3.5 ${accent ? "pl-5" : ""}`}>
      {accent && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-flame" aria-hidden />
      )}
      <p className="text-[11px] font-medium text-mist">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-mist/80">{hint}</p>}
    </div>
  );
}

export function Chip({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      className="chip inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ "--chip-c": color ?? "#aeb0b2" } as CSSProperties}
    >
      {children}
    </span>
  );
}

export function StatusChip({
  status,
}: {
  status: "sent" | "scheduled" | "unscheduled" | "paused" | "active" | "onboarding" | "archived";
}) {
  const map: Record<string, { fg: string; label: string; tip: string }> = {
    sent: {
      fg: "#4ade80", label: "Sent",
      tip: "This lesson has already gone out",
    },
    scheduled: {
      fg: "#a3a4f0", label: "Scheduled",
      tip: "On the calendar — sends automatically on its date",
    },
    unscheduled: {
      fg: "#aeb0b2", label: "Awaiting date",
      tip: "Waits until its trigger session gets a date",
    },
    paused: {
      fg: "#facc15", label: "Paused",
      tip: "The campaign is paused — this send is on hold until it reopens",
    },
    active: {
      fg: "#4ade80", label: "Active",
      tip: "This client has work in progress",
    },
    onboarding: {
      fg: "#ff7a55", label: "Onboarding",
      tip: "Client is being set up — no campaign running yet",
    },
    archived: {
      fg: "#aeb0b2", label: "Archived",
      tip: "No longer active",
    },
  };
  const s = map[status];
  return (
    <span
      data-tip={s.tip}
      className="chip inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ "--chip-c": s.fg } as CSSProperties}
    >
      {s.label}
    </span>
  );
}

export function ProgressBar({
  pct,
  color,
}: {
  pct: number;
  color?: string;
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(pct, pct > 0 ? 4 : 0)}%`,
          backgroundColor: color ?? "var(--color-flame)",
        }}
      />
    </div>
  );
}
