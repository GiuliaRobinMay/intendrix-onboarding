"use client";

// The row above a detail page: the way back, and the way sideways.
//
// Checking one thing across every client used to mean twelve round
// trips through the list — open, read, back, scroll, open the next.
// The arrows walk the same order the list is in, so a column you were
// reading top to bottom stays top to bottom, and the counter tells you
// how far through you are.
//
// The neighbour's name sits on the arrow rather than in a tooltip: it
// turns a guess into a decision before you click.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

export interface PagerItem {
  id: string;
  /** what to call it on the arrow */
  name: string;
  href: string;
}

export function RecordNav({
  backHref,
  backLabel,
  items,
  currentId,
}: {
  backHref: string;
  backLabel: string;
  /** every record of this kind, in the order the list shows them */
  items: PagerItem[];
  currentId: string;
}) {
  const router = useRouter();
  const index = items.findIndex((i) => i.id === currentId);
  const prev = index > 0 ? items[index - 1] : null;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : null;

  // alt + arrow does the same thing without the mouse, which is what you
  // want when you are working down a list. Plain arrows stay free for
  // the browser, and anything you are typing into keeps its keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
      )
        return;
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        router.push(prev.href);
      } else if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        router.push(next.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-paper"
      >
        <ArrowLeft size={13} /> {backLabel}
      </Link>

      {items.length > 1 && index >= 0 && (
        <div className="flex items-center gap-1">
          <Step item={prev} side="prev" />
          <span className="px-1 text-[11px] font-semibold whitespace-nowrap text-mist/70">
            {index + 1} of {items.length}
          </span>
          <Step item={next} side="next" />
        </div>
      )}
    </div>
  );
}

function Step({ item, side }: { item: PagerItem | null; side: "prev" | "next" }) {
  const Icon = side === "prev" ? ChevronLeft : ChevronRight;
  const label = side === "prev" ? "Previous" : "Next";

  // the end of the list keeps its arrow rather than dropping it, so the
  // counter and the controls never shift under the cursor
  if (!item)
    return (
      <span
        aria-hidden
        className="flex h-7 items-center rounded-md border border-white/8 px-1.5 text-mist/30"
      >
        <Icon size={14} />
      </span>
    );

  return (
    <Link
      href={item.href}
      data-tip={`${label}: ${item.name} — or alt + ${side === "prev" ? "←" : "→"}`}
      className="flex h-7 max-w-44 items-center gap-1 rounded-md border border-white/10 px-1.5 text-[11px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
    >
      {side === "prev" && <Icon size={14} className="shrink-0" />}
      <span className="hidden truncate sm:block">{item.name}</span>
      {side === "next" && <Icon size={14} className="shrink-0" />}
    </Link>
  );
}
