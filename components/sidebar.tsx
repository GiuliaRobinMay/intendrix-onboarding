"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useData } from "@/lib/state";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  CalendarDays,
  ChevronsUpDown,
  Inbox,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
} from "lucide-react";

const COLLAPSE_KEY = "intendrix-sidebar-collapsed";
const THEME_KEY = "intendrix-theme";

const groups: Array<{
  label?: string;
  links: Array<{ href: string; label: string; icon: typeof Users; tip: string }>;
}> = [
  {
    links: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, tip: "Overview of clients, campaigns and upcoming sends" },
    ],
  },
  {
    label: "Work",
    links: [
      { href: "/clients", label: "Clients", icon: Users, tip: "All client organizations" },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, tip: "Every campaign across all clients" },
    ],
  },
  {
    label: "Planning",
    links: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays, tip: "Meetings and milestones in one agenda" },
      { href: "/mailbox", label: "Mailbox", icon: Inbox, tip: "Every email that goes out to members" },
    ],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  tip,
}: {
  href: string;
  label: string;
  icon: typeof Users;
  active: boolean;
  collapsed: boolean;
  tip?: string;
}) {
  return (
    <Link
      href={href}
      data-tip={collapsed ? label : tip}
      data-tip-pos="right"
      className={`relative flex items-center gap-2.5 rounded-md py-1.5 text-[13px] transition-colors ${
        collapsed ? "justify-center px-0" : "px-2.5"
      } ${
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
      {!collapsed && label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { backend, syncError } = useData();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [collapsed, setCollapsed] = useState(false);
  const [light, setLight] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
      setLight(document.documentElement.classList.contains("light"));
    } catch {
      // storage unavailable — start expanded, dark
    }
  }, []);
  const toggle = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      } catch {
        // storage unavailable — the choice just won't persist
      }
      return !v;
    });
  };
  const toggleTheme = () => {
    setLight((v) => {
      const next = !v;
      document.documentElement.classList.toggle("light", next);
      try {
        localStorage.setItem(THEME_KEY, next ? "light" : "dark");
      } catch {
        // storage unavailable — the choice just won't persist
      }
      return next;
    });
  };

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-white/8 bg-panel py-4 transition-[width] duration-200 ${
        collapsed ? "w-14 px-2" : "w-56 px-3"
      }`}
    >
      {/* profile management at the top */}
      <button
        data-tip={collapsed ? "Giulia May · Intendrix" : "Your account — profile management arrives with sign-in"}
        data-tip-pos="right"
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md py-2 text-left transition-colors hover:bg-white/4 ${
          collapsed ? "justify-center px-0" : "px-2"
        }`}
      >
        <span className="brand-gradient flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold">
          GM
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-tight">
                Giulia May
              </span>
              <span className="block truncate text-[11px] leading-tight text-mist">
                Intendrix
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-mist" />
          </>
        )}
      </button>

      <div className="my-3 border-t border-white/8" />

      {/* grouped navigation */}
      <nav className="flex flex-col gap-4">
        {groups.map((g, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {g.label &&
              (collapsed ? (
                <div className="mx-1 mb-1.5 border-t border-white/8" aria-hidden />
              ) : (
                <p className="px-2.5 pb-1 text-[11px] font-medium text-mist/60">
                  {g.label}
                </p>
              ))}
            {g.links.map((l) => (
              <NavLink
                key={l.href}
                {...l}
                active={isActive(l.href)}
                collapsed={collapsed}
              />
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
          collapsed={collapsed}
          tip="App settings, campaign blueprints and team"
        />
        <button
          onClick={toggleTheme}
          data-tip={light ? "Switch the whole app to dark colors" : "Switch the whole app to light colors"}
          data-tip-pos="right"
          className={`flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 text-[13px] font-medium text-mist transition-colors hover:bg-white/4 hover:text-paper ${
            collapsed ? "justify-center px-0" : "px-2.5"
          }`}
        >
          {light ? (
            <Moon size={15} strokeWidth={2} className="shrink-0" />
          ) : (
            <Sun size={15} strokeWidth={2} className="shrink-0" />
          )}
          {!collapsed && (light ? "Dark mode" : "Light mode")}
        </button>
        <button
          onClick={toggle}
          data-tip={collapsed ? "Expand the sidebar" : "Shrink the sidebar to icons only"}
          data-tip-pos="right"
          className={`flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 text-[13px] font-medium text-mist transition-colors hover:bg-white/4 hover:text-paper ${
            collapsed ? "justify-center px-0" : "px-2.5"
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen size={15} strokeWidth={2} className="shrink-0" />
          ) : (
            <>
              <PanelLeftClose size={15} strokeWidth={2} className="shrink-0" />
              Collapse
            </>
          )}
        </button>
        {!collapsed && (
          <p
            className={`px-2.5 pt-2 text-[10px] leading-relaxed ${
              syncError ? "font-semibold text-[#ff7a55]" : "text-mist/50"
            }`}
          >
            {syncError
              ? "A change could not be saved — reload the page."
              : backend === "database"
                ? "Connected to the shared database."
                : backend === "browser"
                  ? "Prototype mode — edits stay in this browser."
                  : "…"}
          </p>
        )}
      </div>
    </aside>
  );
}
