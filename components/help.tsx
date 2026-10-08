"use client";

// The "Need help?" button at the foot of the sidebar.
//
// It used to open a panel: room for six questions out of thirty-five,
// and none of the six was about setting a client up, which is the part
// people get stuck on. It is a link to the Help page now — same
// assistant, same guide, with every question visible and grouped, and
// the answer no longer sharing a 24rem box with the list it came from.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";

export function HelpButton({ collapsed = false }: { collapsed?: boolean }) {
  const here = usePathname() === "/help";
  return (
    <Link
      href="/help"
      data-tip="Ask how anything in Intendrix works"
      data-tip-pos="right"
      className={`brand-gradient flex w-full cursor-pointer items-center gap-2.5 rounded-md py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90 ${
        collapsed ? "justify-center px-0" : "px-2.5"
      } ${here ? "opacity-80" : ""}`}
    >
      <HelpCircle size={15} strokeWidth={2.5} className="shrink-0" />
      {!collapsed && "Need help?"}
    </Link>
  );
}
