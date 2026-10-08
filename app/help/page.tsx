"use client";

// Help, as a page rather than a panel.
//
// It used to be a small box at the foot of the sidebar: room for six
// questions out of thirty-five, and everything to do with setting a
// client up — the part people actually get stuck on — was not among the
// six. A page can show all of them at once, grouped, which is the whole
// difference between a help feature and a help feature anybody uses.
//
// The answer stays on the left and the questions stay on the right, so
// reading one never costs you the list you found it in.

import { useEffect, useRef, useState } from "react";
import { ChevronRight, HelpCircle, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { authHeaders } from "@/lib/supabase-browser";
import { HELP_CATEGORIES, HELP_TOPICS, type HelpTopic } from "@/lib/help-guide";

interface Turn {
  role: "user" | "assistant";
  content: string;
  /** true when the answer came from the built-in guide, not the assistant */
  local?: boolean;
}

/** The colour down the left of each group, so the eye can come back to
 *  the same place twice. */
const DOT: Record<string, string> = {
  "Getting started": "#4ade80",
  "Setting up a client": "#a3a4f0",
  "The community": "#6ea8ff",
  "Emails and scheduling": "#facc15",
  "Day to day": "#aeb0b2",
  "When something looks wrong": "#ff7a55",
};

/** Crude but honest matching for the no-assistant fallback: score topics
 *  by how many words of the question appear in their keywords/title. */
function matchTopics(question: string): HelpTopic[] {
  const words = question
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 2);
  return HELP_TOPICS.map((t) => {
    const head = `${t.title} ${t.keywords}`.toLowerCase();
    const body = t.body.toLowerCase();
    const score = words.reduce(
      (n, w) => n + (head.includes(w) ? 2 : body.includes(w) ? 1 : 0),
      0
    );
    return { t, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.t);
}

/** Three more questions from the same group — what you probably wanted
 *  next, rather than what you happened to click. */
function relatedTo(topic: HelpTopic): HelpTopic[] {
  return HELP_TOPICS.filter(
    (t) => t.category === topic.category && t.title !== topic.title
  ).slice(0, 3);
}

export default function HelpPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [related, setRelated] = useState<HelpTopic[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [openGroup, setOpenGroup] = useState<string>(HELP_CATEGORIES[0]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, busy]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setDraft("");
    setRelated([]);
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
              : "The built-in guide has nothing on that — try one of the questions on the right, or ask Giulia.",
          },
        ]);
        if (hits.length) setRelated(relatedTo(hits[0]));
      } else {
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            local: true,
            content: out.reason ?? "Something went wrong — try again.",
          },
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
    setTurns((t) => [
      ...t,
      { role: "user", content: topic.title },
      { role: "assistant", content: topic.body, local: true },
    ]);
    setRelated(relatedTo(topic));
  };

  return (
    <>
      <PageHeader
        title="Help"
        subtitle="How Intendrix works — ask in your own words, or pick a question."
      />

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* the answer */}
        <section className="card flex min-h-[32rem] flex-1 flex-col overflow-hidden lg:h-[calc(100vh-13rem)]">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-5">
            {turns.length === 0 ? (
              <>
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <HelpCircle size={17} className="text-[#ff7a55]" /> What do you
                  need?
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-mist">
                  Pick a question on the right, or type one below in your own
                  words. Everything here is about this app and the community work
                  around it — setting a client up, inviting their team, and
                  getting the lessons out.
                </p>
                <div className="mt-4 flex flex-col gap-1.5">
                  {HELP_TOPICS.filter((t) => t.category === "Getting started").map(
                    (t) => (
                      <button
                        key={t.title}
                        onClick={() => showTopic(t)}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2 text-left text-xs font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
                      >
                        {t.title}
                        <ChevronRight size={13} className="shrink-0 opacity-60" />
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                {turns.map((t, i) =>
                  t.role === "user" ? (
                    <p
                      key={i}
                      className="ml-12 self-end rounded-lg rounded-br-sm bg-white/8 px-3.5 py-2 text-xs font-semibold"
                    >
                      {t.content}
                    </p>
                  ) : (
                    <div
                      key={i}
                      className="mr-8 self-start rounded-lg rounded-bl-sm bg-navy/60 px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap text-paper/90"
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
                {busy && (
                  <p className="flex items-center gap-1.5 text-xs text-mist">
                    <Sparkles size={12} /> Thinking…
                  </p>
                )}

                {related.length > 0 && !busy && (
                  <div className="mt-1 border-t border-white/8 pt-3">
                    <p className="text-[10px] font-bold tracking-wider text-mist/70 uppercase">
                      Related
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {related.map((t) => (
                        <button
                          key={t.title}
                          onClick={() => showTopic(t)}
                          className="cursor-pointer rounded-full border border-white/12 px-3 py-1.5 text-[11px] font-semibold text-mist transition-colors hover:border-white/30 hover:text-paper"
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
              className="brand-gradient flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send size={13} /> Ask
            </button>
          </form>
        </section>

        {/* every question there is, grouped */}
        <aside className="card w-full shrink-0 overflow-y-auto p-4 lg:h-[calc(100vh-13rem)] lg:w-80">
          <p className="text-[10px] font-bold tracking-wider text-[#ff7a55] uppercase">
            Find your way around
          </p>
          <h2 className="mt-1 text-base font-bold">What are you looking for?</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-mist">
            {HELP_TOPICS.length} questions, grouped. Open one and the answer
            appears on the left.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {HELP_CATEGORIES.map((group) => {
              const inGroup = HELP_TOPICS.filter((t) => t.category === group);
              if (!inGroup.length) return null;
              const open = openGroup === group;
              return (
                <div
                  key={group}
                  className="overflow-hidden rounded-lg border border-white/10"
                >
                  <button
                    onClick={() => setOpenGroup(open ? "" : group)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: DOT[group] ?? "#aeb0b2" }}
                      />
                      <span className="truncate text-xs font-bold">{group}</span>
                    </span>
                    <ChevronRight
                      size={13}
                      className={`shrink-0 text-mist transition-transform ${
                        open ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  {open && (
                    <div className="flex flex-col border-t border-white/8">
                      {inGroup.map((t) => (
                        <button
                          key={t.title}
                          onClick={() => showTopic(t)}
                          className="cursor-pointer px-3 py-2 text-left text-[11px] leading-snug text-mist transition-colors hover:bg-white/5 hover:text-paper"
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </>
  );
}
