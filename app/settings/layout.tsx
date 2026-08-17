"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, SlidersHorizontal, Users } from "lucide-react";

const tabs = [
  { href: "/settings", label: "App settings", icon: SlidersHorizontal, exact: true },
  { href: "/settings/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/settings/team", label: "Team", icon: Users },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <nav className="mt-5 mb-8 flex flex-wrap gap-2 border-b border-white/8 pb-3">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "brand-gradient-soft flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-paper"
                  : "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-mist transition-colors hover:bg-white/5 hover:text-paper"
              }
            >
              <Icon size={15} strokeWidth={2.2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </>
  );
}
