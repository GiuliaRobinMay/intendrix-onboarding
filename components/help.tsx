"use client";

// "Need help?" — the bottom-right assistant. Ask in your own words and
// get an answer about how this app works. With an assistant configured
// (ANTHROPIC_API_KEY on the server) answers are conversational; without
// one, questions are matched against the built-in guide, and the topic
// list works either way.

import { useEffect, useRef, useState } from "react";
import { HelpCircle, Send, X } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { HELP_TOPICS, type HelpTopic } from "@/lib/help-guide";

interface Turn {
  role: "user" | "assistant";
  content: string;
  /** true when the answer came from the built-in guide, not the assistant */
  local?: boolean;
}

/** Crude but honest matching for the no-assistant fallback: score topics
 *  by how many words of the question appear in their keywords/title. */
function matchTopics(question: string): HelpTopic[] {
  const words = question
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 2);
  const scored = HELP_TOPICS.map((t) => {
    const head = `${t.title} ${t.keywords}`.toLowerCase();
    const body = t.body.toLowerCase();
    // a hit in the title or keywords says more than one in the prose
    const score = words.reduce(
      (n, w) => n + (head.includes(w) ? 2 : body.includes(w) ? 1 : 0),
      0
    );
    return { t, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((x) => x.t);
}

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTopics, setShowTopics] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, busy, open]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setDraft("");
    setShowTopics(false);
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/help", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ question, history }),
      });
      const out = await res.json();
      if (out.ok) {
        setTurns((t) => [...t, { role: "assistant", content: out.answer }]);
      } else if (out.reason === "assistant not configured") {
        const hits = matchTopics(question);
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            local: true,
            content: hits.length
              ? hits.map((h) => `${h.title}\n${h.body}`).join("\n\n")
              : "The built-in guide has nothing on that — try one of the topics below, or ask Giulia.",
          },
        ]);
        if (!hits.length) setShowTopics(true);
      } else {
        setTurns((t) => [
          ...t,
          { role: "assistant", local: true, content: out.reason ?? "Something went wrong — try again." },
        ]);
      }
    } catch {
      setTurns((t) => [
        ...t,
        { role: "assistant", local: true, content: "Could not reach the server — try again." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const showTopic = (topic: HelpTopic) => {
    setShowTopics(false);
    setTurns((t) => [
      ...t,
      { role: "user", content: topic.title },
      { role: "assistant", content: topic.body, local: true },
    ]);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          data-tip="Ask how anything in Intendrix works"
          data-tip-pos="top"
          className="brand-gradient fixed bottom-5 right-5 z-40 flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold text-white shadow-xl shadow-black/40 transition-opacity hover:opacity-90"
        >
          <HelpCircle size={16} /> Need help?
        </button>
      )}

      {open && (
        <div className="card fixed bottom-5 right-5 z-40 flex h-[32rem] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-bold">
              <HelpCircle size={15} className="text-[#ff7a55]" /> How Intendrix works
            </p>
            <button
              onClick={() => setOpen(false)}
              data-tip="Close — the conversation stays"
              className="cursor-pointer rounded-md p-1 text-mist hover:bg-white/8 hover:text-paper"
            >
              <X size={15} />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {turns.length === 0 && (
              <p className="mb-3 text-xs leading-relaxed text-mist">
                Ask anything about using this app — sending, scheduling,
                statuses, members — or pick a question below.
              </p>
            )}
            <div className="flex flex-col gap-2.5">
              {turns.map((t, i) =>
                t.role === "user" ? (
                  <p
                    key={i}
                    className="ml-8 self-end rounded-lg rounded-br-sm bg-white/8 px-3 py-2 text-xs font-semibold"
                  >
                    {t.content}
                  </p>
                ) : (
                  <div
                    key={i}
                    className="mr-4 self-start whitespace-pre-wrap rounded-lg rounded-bl-sm bg-navy/60 px-3 py-2 text-xs leading-relaxed text-paper/90"
                  >
                    {t.content}
                    {t.local && (
                      <span className="mt-1.5 block text-[10px] text-mist/60">
                        from the built-in guide
                      </span>
                    )}
                  </div>
                )
              )}
              {busy && <p className="text-xs text-mist">Thinking…</p>}
            </div>

            {showTopics && (
              <div className="mt-3 flex flex-col gap-1.5">
                {HELP_TOPICS.slice(0, 6).map((t) => (
                  <button
                    key={t.title}
                    onClick={() => showTopic(t)}
                    className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-left text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
            className="flex items-center gap-2 border-t border-white/8 p-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a question…"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-navy/60 px-3 py-2 text-xs focus:border-white/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              data-tip="Ask"
              className="cursor-pointer rounded-md border border-white/10 p-2 text-mist transition-colors hover:border-white/25 hover:text-paper disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
