"use client";

// A short walk through the things that must be filled in.
//
// The forms this replaces were honest about what they needed and said
// nothing about what they did not: a campaign could be created without
// a Phoenix team, without a sender and in the wrong timezone, and
// nothing anywhere said so until a client got mail from the wrong
// person. Everything optional is still optional here — but it is asked,
// once, in front of someone, instead of waiting quietly on a page
// nobody opens twice.
//
// A step can refuse to let you past it. Nothing else is enforced: the
// last step can always be reached, because a person who knows what they
// are leaving out is not the problem this solves.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

export interface WizardStep {
  title: string;
  /** one line under the title: what this step is for */
  hint?: string;
  body: ReactNode;
  /** false keeps Next disabled; say why in blocker */
  ready?: boolean;
  blocker?: string;
  /** shown on the step when something is being left out on purpose */
  warning?: string;
}

export function Wizard({
  title,
  steps,
  finishLabel,
  onFinish,
  onClose,
}: {
  title: string;
  steps: WizardStep[];
  finishLabel: string;
  onFinish: () => void;
  onClose: () => void;
}) {
  const [at, setAt] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;
  const step = steps[Math.min(at, steps.length - 1)];
  const last = at === steps.length - 1;
  const ready = step.ready !== false;

  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-black/55 px-6 py-10"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-2xl p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold">{title}</h2>
            <p className="mt-0.5 text-[11px] text-mist">
              Step {at + 1} of {steps.length} · {step.title}
            </p>
          </div>
          <button
            data-tip="Close without creating anything"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-md p-1 text-mist hover:bg-white/5 hover:text-paper"
          >
            <X size={16} />
          </button>
        </div>

        {/* the rail: where you are, and what is still coming */}
        <div className="mt-4 flex items-center gap-1">
          {steps.map((s, i) => (
            <button
              key={s.title}
              data-tip={i > at ? `${s.title} — finish this step first` : s.title}
              onClick={() => i < at && setAt(i)}
              disabled={i > at}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < at
                  ? "cursor-pointer bg-[#4ade80]"
                  : i === at
                    ? "brand-gradient"
                    : "cursor-default bg-white/12"
              }`}
            />
          ))}
        </div>

        {step.hint && (
          <p className="mt-4 text-xs leading-relaxed text-mist">{step.hint}</p>
        )}

        <div className="mt-4">{step.body}</div>

        {step.warning && (
          <p className="mt-4 rounded-lg border border-[#facc15]/35 bg-[#facc15]/10 p-2.5 text-[11px] leading-relaxed text-[#facc15]">
            {step.warning}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
          <span className="min-w-0 text-[11px] text-[#ff7a55]">
            {!ready && step.blocker ? step.blocker : ""}
          </span>
          <div className="flex shrink-0 gap-2">
            {at > 0 && (
              <button
                onClick={() => setAt((n) => n - 1)}
                className="cursor-pointer rounded-md border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
              >
                Back
              </button>
            )}
            <button
              disabled={!ready}
              onClick={() => (last ? onFinish() : setAt((n) => n + 1))}
              className="brand-gradient flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {last ? (
                <>
                  <Check size={13} /> {finishLabel}
                </>
              ) : (
                "Next"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
