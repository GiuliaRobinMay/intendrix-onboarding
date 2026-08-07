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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mist">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function GradientButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="brand-gradient cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-paper shadow-lg shadow-flame/20 transition-transform hover:scale-[1.02]"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
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
    <div className={`card px-5 py-4 ${accent ? "brand-gradient-soft border-transparent" : ""}`}>
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          accent ? "text-paper/80" : "text-mist"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {hint && (
        <p className={`mt-1 text-xs ${accent ? "text-paper/70" : "text-mist/80"}`}>
          {hint}
        </p>
      )}
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
  status: "sent" | "scheduled" | "unscheduled" | "active" | "onboarding" | "archived";
}) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    sent: { bg: "rgba(74,222,128,0.14)", fg: "#4ade80", label: "Sent" },
    scheduled: { bg: "rgba(123,124,216,0.18)", fg: "#a3a4f0", label: "Scheduled" },
    unscheduled: { bg: "rgba(174,176,178,0.12)", fg: "#aeb0b2", label: "Awaiting date" },
    active: { bg: "rgba(74,222,128,0.14)", fg: "#4ade80", label: "Active" },
    onboarding: { bg: "rgba(235,50,15,0.16)", fg: "#ff7a55", label: "Onboarding" },
    archived: { bg: "rgba(174,176,178,0.12)", fg: "#aeb0b2", label: "Archived" },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
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
