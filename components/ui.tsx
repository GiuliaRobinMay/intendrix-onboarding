import type { ReactNode } from "react";

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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/8 pb-4">
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
      className="brand-gradient cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-semibold text-paper transition-opacity hover:opacity-90"
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
      className="cursor-pointer rounded-lg border border-white/10 px-3.5 py-2 text-[13px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
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
        <span className="brand-gradient absolute inset-y-0 left-0 w-0.5" aria-hidden />
      )}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-mist">
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
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        backgroundColor: color ? `${color}26` : "rgba(174,176,178,0.12)",
        color: color ?? "#aeb0b2",
      }}
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
  const map: Record<string, { bg: string; fg: string; label: string; tip: string }> = {
    sent: {
      bg: "rgba(74,222,128,0.14)", fg: "#4ade80", label: "Sent",
      tip: "This lesson has already gone out",
    },
    scheduled: {
      bg: "rgba(123,124,216,0.18)", fg: "#a3a4f0", label: "Scheduled",
      tip: "On the calendar — sends automatically on its date",
    },
    unscheduled: {
      bg: "rgba(174,176,178,0.12)", fg: "#aeb0b2", label: "Awaiting date",
      tip: "Waits until its trigger session gets a date",
    },
    paused: {
      bg: "rgba(250,204,21,0.15)", fg: "#facc15", label: "Paused",
      tip: "The campaign is paused — this send is on hold until it reopens",
    },
    active: {
      bg: "rgba(74,222,128,0.14)", fg: "#4ade80", label: "Active",
      tip: "This client has work in progress",
    },
    onboarding: {
      bg: "rgba(235,50,15,0.16)", fg: "#ff7a55", label: "Onboarding",
      tip: "Client is being set up — no campaign running yet",
    },
    archived: {
      bg: "rgba(174,176,178,0.12)", fg: "#aeb0b2", label: "Archived",
      tip: "No longer active",
    },
  };
  const s = map[status];
  return (
    <span
      data-tip={s.tip}
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
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
        className={color ? "h-full rounded-full" : "brand-gradient h-full rounded-full"}
        style={{
          width: `${Math.max(pct, pct > 0 ? 4 : 0)}%`,
          ...(color ? { backgroundColor: color } : {}),
        }}
      />
    </div>
  );
}
