"use client";

// One confirmation dialog for every delete in the app. Nothing named is
// ever removed on a single click: the dialog says exactly what is about
// to go, and Delete / Cancel decide it.
//
// Usage:
//   const confirmDelete = useConfirm();
//   if (await confirmDelete({ name: session.name, detail: "…" })) dispatch(…)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Trash2, TriangleAlert } from "lucide-react";

export interface ConfirmRequest {
  /** what is being deleted, quoted in the dialog */
  name: string;
  /** one sentence on the consequences, shown under the question */
  detail?: string;
  /** the red button's word — "Delete" unless something fits better */
  verb?: string;
  /** the question's verb — "delete" unless the act is something else,
   *  e.g. "cancel" for an email that stays but never sends */
  action?: string;
}

type Ask = (req: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    req: ConfirmRequest;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const ask = useCallback<Ask>(
    (req) => new Promise((resolve) => setPending({ req, resolve })),
    []
  );

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  // Escape cancels, like closing any dialog
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6"
          onClick={() => answer(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-sm p-5 shadow-2xl shadow-black/50"
          >
            <p className="flex items-start gap-2.5 text-sm font-bold leading-snug">
              {(pending.req.action ?? "delete") === "delete" ? (
                <Trash2 size={16} className="mt-0.5 shrink-0 text-[#ff7a55]" />
              ) : (
                <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#ff7a55]" />
              )}
              <span>
                Are you sure you want to {pending.req.action ?? "delete"}{" "}
                <span className="text-[#ff7a55]">
                  &ldquo;{pending.req.name}&rdquo;
                </span>
                ?
              </span>
            </p>
            {pending.req.detail && (
              <p className="mt-2 pl-[26px] text-xs leading-relaxed text-mist">
                {pending.req.detail}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                autoFocus
                onClick={() => answer(false)}
                className="cursor-pointer rounded-md border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
              >
                Cancel
              </button>
              <button
                onClick={() => answer(true)}
                className="cursor-pointer rounded-md bg-[#eb320f] px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#c92a0c]"
              >
                {pending.req.verb ?? "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/** The ask-before-deleting function. Resolves true only on the red button. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ask;
}
