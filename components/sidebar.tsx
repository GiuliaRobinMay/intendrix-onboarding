"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  CalendarDays,
  ChevronsUpDown,
  Inbox,
  Settings,
} from "lucide-react";

const groups: Array<{
  label?: string;
  links: Array<{ href: string; label: string; icon: typeof Users }>;
}> = [
  {
    links: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Work",
    links: [
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Planning",
    links: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/mailbox", label: "Mailbox", icon: Inbox },
    ],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Users;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-white/6 font-semibold text-paper"
          : "font-medium text-mist hover:bg-white/4 hover:text-paper"
      }`}
    >
      {active && (
        <span
          className="brand-gradient absolute inset-y-1 left-0 w-0.5 rounded-full"
          aria-hidden
        />
      )}
      <Icon size={15} strokeWidth={2} className="shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-white/8 bg-[#0b0d1d] px-3 py-4">
      {/* profile management at the top */}
      <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/4">
        <span className="brand-gradient flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold">
          GM
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight">
            Giulia May
          </span>
          <span className="block truncate text-[11px] leading-tight text-mist">
            Intendrix
          </span>
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-mist" />
      </button>

      <div className="my-3 border-t border-white/8" />

      {/* grouped navigation */}
      <nav className="flex flex-col gap-4">
        {groups.map((g, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {g.label && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-mist/60">
                {g.label}
              </p>
            )}
            {g.links.map((l) => (
              <NavLink key={l.href} {...l} active={isActive(l.href)} />
            ))}
          </div>
        ))}
      </nav>

      {/* rarely used links live at the bottom */}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/8 pt-3">
        <NavLink
          href="/settings"
          label="Settings"
          icon={Settings}
          active={isActive("/settings")}
        />
        <p className="px-2.5 pt-2 text-[10px] leading-relaxed text-mist/50">
          Email + password sign-in arrives with the Supabase phase.
        </p>
      </div>
    </aside>
  );
}
