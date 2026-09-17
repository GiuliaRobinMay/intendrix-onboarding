"use client";

// The running record the team keeps on a campaign: what was done, what
// the client asked for, what to watch out for next time.
//
// Deliberately not one editable field. A field invites overwriting, and
// the whole point of this is that last month's entry survives. Each
// note keeps who wrote it and when, newest on top.

import { useEffect, useState } from "react";
import { NotebookPen, Trash2 } from "lucide-react";
import { authConfigured, getSupabase } from "@/lib/supabase-browser";
import { useConfirm } from "@/components/confirm";
import { useData } from "@/lib/state";
import type { Campaign } from "@/lib/types";

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
      });
};

export function CampaignNotes({
  clientId,
  campaign,
}: {
  clientId: string;
  campaign: Campaign;
}) {
  const { dispatch } = useData();
  const confirmDelete = useConfirm();
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

  const notes = campaign.notes ?? [];

  const add = () => {
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
  };

  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <NotebookPen size={16} className="text-mist" /> Notes
        {notes.length > 0 && (
          <span className="text-sm font-medium text-mist">({notes.length})</span>
        )}
      </h2>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // the same shortcut every chat box has, because everyone tries it
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
        }}
        rows={2}
        placeholder="What happened, what was agreed, what to watch…"
        data-tip="Kept forever, newest on top. Cmd/Ctrl + Enter saves."
        className="w-full resize-y rounded-md border border-white/10 bg-navy/60 px-2.5 py-2 text-xs leading-relaxed focus:border-white/30 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-mist/60">
          {me ? `Saved as ${me}` : "Saved without a name"}
        </span>
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="cursor-pointer rounded-md border border-white/12 px-2.5 py-1 text-[11px] font-semibold text-paper transition-colors hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Add note
        </button>
      </div>

      {notes.length > 0 && (
        <div className="mt-3 flex max-h-[18rem] flex-col gap-2.5 overflow-y-auto border-t border-white/8 pt-3 pr-1">
          {notes.map((n) => (
            <div key={n.id} className="group">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs leading-relaxed text-paper">
                  {n.body}
                </p>
                <button
                  data-tip="Delete this note"
                  onClick={async () => {
                    if (
                      await confirmDelete({
                        name: "this note",
                        detail: "It is gone for everyone, and cannot be brought back.",
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
                  className="shrink-0 cursor-pointer rounded p-1 text-mist/0 transition-colors group-hover:text-mist/60 hover:bg-[#eb320f]/20 hover:!text-[#ff7a55]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="mt-0.5 text-[10px] text-mist/60">
                {n.author ? `${n.author} · ` : ""}
                {fmtWhen(n.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
