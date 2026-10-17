"use client";

// The set-up checklist, as a button with a count and a popup with the
// steps.
//
// Everything on it is known somewhere in the app already; what people
// lacked was the path — which thing comes next, and whether the last
// one is really done. So the popup shows the client's steps in order,
// then each running campaign's, each line with where it is done and a
// way to ask how.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CircleCheck, Circle, HelpCircle, ListChecks, X } from "lucide-react";
import { useData } from "@/lib/state";
import { campaignStatus } from "@/lib/store";
import { campaignSteps, clientSteps, type Step } from "@/lib/checklist";
import type { Client } from "@/lib/types";

export function SetupChecklist({
  client,
  campaignId,
}: {
  client: Client;
  /** on a campaign page: only that campaign's steps, under the client's */
  campaignId?: string;
}) {
  const { staff, templates } = useData();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const campaigns = campaignId
    ? client.campaigns.filter((c) => c.id === campaignId)
    : // finished campaigns have nothing left to set up
      client.campaigns.filter((c) => campaignStatus(c, templates, new Date()) !== "closed");

  const sections: Array<{ title: string; steps: Step[] }> = [
    { title: client.name, steps: clientSteps(client, staff) },
    ...campaigns.map((c) => ({ title: c.name, steps: campaignSteps(client, c, staff) })),
  ];
  const all = sections.flatMap((s) => s.steps);
  const done = all.filter((s) => s.done).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-tip="Everything this client needs before the first lesson can go out, in order — and what is still missing"
        className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-[13px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
      >
        <ListChecks size={14} />
        Checklist
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
            done === all.length ? "bg-[#4ade80]/15 text-[#4ade80]" : "bg-white/10 text-paper"
          }`}
        >
          {done}/{all.length}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-black/55 px-6 py-10"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="card w-full max-w-2xl p-0"
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    <ListChecks size={17} className="text-mist" />
                    Set-up checklist
                  </h2>
                  <p className="mt-1 text-xs text-mist">
                    {done === all.length
                      ? "Everything is in place."
                      : `${done} of ${all.length} done — ${all.length - done} to go. Each line says where it is done; the ? asks how.`}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  data-tip="Close"
                  className="cursor-pointer rounded p-1 text-mist hover:text-paper"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                {sections.map((section, i) => (
                  <div key={section.title + i} className={i ? "mt-5" : ""}>
                    <h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-bold tracking-wider text-mist uppercase">
                      {i === 0 ? "Client" : "Campaign"} · {section.title}
                      <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-bold normal-case tracking-normal">
                        {section.steps.filter((s) => s.done).length}/{section.steps.length}
                      </span>
                    </h3>
                    <ol className="divide-y divide-white/5">
                      {section.steps.map((step, j) => (
                        <li key={step.id} className="flex items-start gap-3 py-2.5">
                          <span className="mt-0.5 w-4 shrink-0 text-right text-[11px] font-bold text-mist/60">
                            {j + 1}
                          </span>
                          {step.done ? (
                            <CircleCheck size={16} className="mt-0.5 shrink-0 text-[#4ade80]" />
                          ) : (
                            <Circle size={16} className="mt-0.5 shrink-0 text-[#ff7a55]" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-sm font-semibold ${
                                step.done ? "text-mist" : ""
                              }`}
                            >
                              {step.label}
                            </span>
                            <span className="block text-[11px] leading-relaxed text-mist">
                              {step.detail}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {!step.done && (
                              <button
                                data-tip="Go where this is done"
                                onClick={() => {
                                  setOpen(false);
                                  router.push(step.href);
                                }}
                                className="flex cursor-pointer items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
                              >
                                Go <ArrowRight size={11} />
                              </button>
                            )}
                            <Link
                              href={`/help?q=${encodeURIComponent(step.help)}`}
                              data-tip={`Ask: ${step.help}`}
                              className="flex items-center rounded-md p-1 text-mist hover:text-paper"
                            >
                              <HelpCircle size={14} />
                            </Link>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
