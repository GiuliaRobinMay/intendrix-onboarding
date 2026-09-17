"use client";

// The running record the team keeps on a campaign: what was done, what
// the client asked for, what to watch out for next time.
//
// Deliberately not one editable field. A field invites overwriting, and
// the whole point of this is that last month's entry survives. Each
// note keeps who wrote it and when, newest on top, and writing one
// happens in its own window so the list stays a list.

import { useEffect, useState } from "react";
import { NotebookPen, Plus, Trash2, X } from "lucide-react";
import { authConfigured, getSupabase } from "@/lib/supabase-browser";
import { useConfirm } from "@/components/confirm";
import { useData } from "@/lib/state";
import type { Campaign } from "@/lib/types";

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
      });
};

const COLS = "grid-cols-[minmax(0,1fr)_9rem_7.5rem_1.75rem]";

export function CampaignNotes({
  clientId,
  campaign,
}: {
  clientId: string;
  campaign: Campaign;
}) {
  const { dispatch } = useData();
  const confirmDelete = useConfirm();
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [me, setMe] = useState<string | null>(null);

  // whoever is signed in gets their name on what they write
  useEffect(() => {
    if (!authConfigured) return;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        const u = data.session?.user;
        if (u) setMe((u.user_metadata?.full_name as string) || u.email || null);
      })
      .catch(() => {
        // not signed in — the note simply carries no name
      });
  }, []);

  // newest first, always: the most recent thing that happened is the
  // thing you came to read
  const notes = [...(campaign.notes ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const save = () => {
    const body = draft.trim();
    if (!body) return;
    dispatch({
      type: "addCampaignNote",
      clientId,
      campaignId: campaign.id,
      body,
      author: me,
    });
    setDraft("");
    setWriting(false);
  };

  const close = () => {
    setWriting(false);
    setDraft("");
  };

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <NotebookPen size={16} className="text-mist" /> Notes
          {notes.length > 0 && (
            <span className="text-sm font-medium text-mist">({notes.length})</span>
          )}
        </h2>
        <button
          onClick={() => setWriting(true)}
          data-tip="Write something down about this campaign — it is kept for the whole team"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/12 px-2.5 py-1.5 text-[11px] font-semibold text-paper transition-colors hover:border-white/30"
        >
          <Plus size={13} /> Add note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="py-3 text-xs text-mist">Nothing written down yet.</p>
      ) : (
        <>
          <div
            className={`grid ${COLS} gap-3 border-b border-white/8 pb-1 text-[11px] font-medium text-mist`}
          >
            <span>Note</span>
            <span>Written by</span>
            <span>When</span>
            <span />
          </div>
          <div className="flex max-h-[20rem] flex-col overflow-y-auto pr-1">
            {notes.map((n) => (
              <div
                key={n.id}
                className={`group grid ${COLS} items-start gap-3 border-b border-white/5 py-2 last:border-b-0`}
              >
                <p className="min-w-0 whitespace-pre-wrap text-xs leading-relaxed text-paper">
                  {n.body}
                </p>
                <span className="truncate text-[11px] text-mist">
                  {n.author ?? "—"}
                </span>
                <span
                  data-tip={new Date(n.createdAt).toLocaleString("en-US")}
                  className="text-[11px] text-mist"
                >
                  {fmtWhen(n.createdAt)}
                </span>
                <button
                  data-tip="Delete this note"
                  onClick={async () => {
                    if (
                      await confirmDelete({
                        name: "this note",
                        detail:
                          "It is gone for everyone, and cannot be brought back.",
                        verb: "Delete",
                      })
                    )
                      dispatch({
                        type: "removeCampaignNote",
                        clientId,
                        campaignId: campaign.id,
                        noteId: n.id,
                      });
                  }}
                  className="cursor-pointer justify-self-end rounded p-1 text-mist/0 transition-colors group-hover:text-mist/60 hover:bg-[#eb320f]/20 hover:!text-[#ff7a55]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* writing happens in its own window, so a half-typed note never
          sits in the middle of the list */}
      {writing && (
        <div
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-lg p-5 shadow-2xl shadow-black/50"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold">
                <NotebookPen size={15} className="text-mist" /> New note
              </p>
              <button
                onClick={close}
                data-tip="Close without saving"
                className="cursor-pointer rounded-md p-1 text-mist transition-colors hover:bg-white/10 hover:text-paper"
              >
                <X size={15} />
              </button>
            </div>

            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
                if (e.key === "Escape") close();
              }}
              rows={6}
              placeholder="What happened, what was agreed, what to watch…"
              className="w-full resize-y rounded-md border border-white/12 bg-navy/60 px-3 py-2.5 text-xs leading-relaxed focus:border-white/35 focus:outline-none"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-mist">
                {me ? `Saved as ${me}` : "Saved without a name"} ·{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={close}
                  className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={!draft.trim()}
                  className="brand-gradient cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Save note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
