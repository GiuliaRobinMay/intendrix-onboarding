"use client";

// The dashboard asks one question: what needs me today?
//
// It used to count things — active clients, campaigns, lessons in the
// library. All true, and none of it answerable: nobody can act on
// "12 campaigns". Meanwhile the things that actually cost this team
// weeks were invisible, because each one is small and lives inside a
// page nobody reopens: an address that bounced, a session nobody
// dated, a campaign with nobody to send from.
//
// Every row here is something a person can fix, and goes to the place
// they fix it.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { PageHeader, GradientButton } from "@/components/ui";
import { EngineBanner } from "@/components/engine-banner";
import { useData } from "@/lib/state";
import { attentionCount, attentionItems } from "@/lib/attention";
import { fmtDate } from "@/lib/store";
import { TONE } from "@/lib/status-colors";

export default function DashboardPage() {
  const { clients, templates, staff } = useData();
  const router = useRouter();
  const today = new Date();
  const groups = attentionItems(clients, templates, staff, today);
  const { total, now } = attentionCount(groups);

  return (
    <>
      <EngineBanner />
      <PageHeader
        title="What needs you"
        subtitle={
          total === 0
            ? `${fmtDate(today)} — nothing is waiting.`
            : `${fmtDate(today)} — ${total} thing${total === 1 ? "" : "s"} waiting${
                now ? `, ${now} of them today` : ""
              }.`
        }
        action={
          <GradientButton onClick={() => router.push("/clients?new=1")}>
            + New client
          </GradientButton>
        }
      />

      {total === 0 ? (
        <section className="card flex flex-col items-center gap-2 p-12 text-center">
          <Check size={22} className="text-[#4ade80]" />
          <p className="text-sm font-bold">Nothing needs you</p>
          <p className="max-w-md text-xs leading-relaxed text-mist">
            Every email went out, every address works, every session has a date
            and every client is set up. This page fills itself when that stops
            being true.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.map((group) => (
            <section key={group.kind} className="card overflow-hidden">
              <div className="border-b border-white/8 px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  {group.title}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-mist">
                    {group.items.length}
                  </span>
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-mist">
                  {group.hint}
                </p>
              </div>

              <ul className="divide-y divide-white/5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-white/4"
                    >
                      {/* red cannot wait, amber should not wait long */}
                      <span
                        aria-hidden
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            item.urgency === "now" ? TONE.red : TONE.yellow,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-mist">
                          {item.where}
                          {item.detail ? ` · ${item.detail}` : ""}
                        </span>
                      </span>
                      <ArrowRight
                        size={14}
                        className="mt-0.5 shrink-0 text-mist"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
