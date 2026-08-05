"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Layers,
  Activity,
  Settings,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/modules", label: "Modules", icon: Layers },
  { href: "/progress", label: "Progress", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-navy/40 px-4 py-6 backdrop-blur">
      <Link href="/" className="px-3">
        <span className="brand-gradient-text text-2xl font-bold tracking-tight">
          Intendrix
        </span>
        <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-mist/70">
          Team Backend
        </span>
      </Link>

      <nav className="mt-10 flex flex-col gap-1.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "brand-gradient-soft flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-paper shadow-lg shadow-flame/10"
                  : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-mist transition-colors hover:bg-white/5 hover:text-paper"
              }
            >
              <Icon size={17} strokeWidth={2.2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="card flex items-center gap-3 px-3 py-3">
          <div className="brand-gradient flex size-9 items-center justify-center rounded-full text-xs font-bold">
            GM
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Giulia May</p>
            <p className="truncate text-xs text-mist">Admin</p>
          </div>
        </div>
        <p className="mt-3 px-1 text-[11px] leading-relaxed text-mist/60">
          Google sign-in arrives with the Supabase phase.
        </p>
      </div>
    </aside>
  );
}
