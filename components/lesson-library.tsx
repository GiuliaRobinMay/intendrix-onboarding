"use client";

// The lesson spaces, their modules and their lessons — read from
// Mighty Networks — with what the team keeps about each lesson here.
//
// Mighty holds the lessons themselves. What it does not hold is the
// material that goes out ABOUT a lesson: a line saying what it is
// about, the image for a post or the top of an email, the PDF, the
// video, the podcast. That lives here, one row per lesson, typed in
// place, and is what the emails and the Phoenix Updates posts draw on.

import { useEffect, useState } from "react";
import { ChevronRight, ExternalLink, Image as ImageIcon, Link2, RefreshCw, TriangleAlert } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { EditableText } from "@/components/editable";
import { GhostButton } from "@/components/ui";

interface Assets {
  about: string;
  imageUrl: string | null;
  pdfUrl: string | null;
  videoUrl: string | null;
  podcastUrl: string | null;
}
interface Lesson {
  id: string;
  title: string;
  url: string | null;
  status: string | null;
  type: string;
  assets: Assets;
}
interface Module {
  id: string;
  title: string;
  url: string | null;
  lessons: Lesson[];
}
interface Space {
  id: string;
  name: string;
  url: string;
  reason?: string;
  modules: Module[];
}

const LINKS: Array<{ key: keyof Assets; label: string; placeholder: string }> = [
  { key: "pdfUrl", label: "PDF", placeholder: "Paste the PDF link…" },
  { key: "videoUrl", label: "Video", placeholder: "Paste the video link…" },
  { key: "podcastUrl", label: "Podcast", placeholder: "Paste the podcast link…" },
];

const clean = (t: string) => t.replace(/^[➽»›>\s]+/, "");

export function LessonLibrary() {
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lessons", { headers: await authHeaders() });
      const out = await res.json();
      if (out.ok) {
        setSpaces(out.spaces);
        setReason(null);
        // the first space opens by itself; the rest wait to be asked
        setOpen((s) => (s.size ? s : new Set(out.spaces.slice(0, 1).map((x: Space) => x.id))));
      } else setReason(out.reason ?? "could not read the lessons");
    } catch {
      setReason("could not reach the server");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  // saved as typed, and shown as typed — the server's word only comes
  // back when it refused
  const save = async (spaceId: string, lesson: Lesson, patch: Partial<Assets>) => {
    setSpaces((all) =>
      all
        ? all.map((sp) =>
            sp.id !== spaceId
              ? sp
              : {
                  ...sp,
                  modules: sp.modules.map((m) => ({
                    ...m,
                    lessons: m.lessons.map((l) =>
                      l.id === lesson.id ? { ...l, assets: { ...l.assets, ...patch } } : l
                    ),
                  })),
                }
          )
        : all
    );
    try {
      const res = await fetch("/api/lessons", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ courseworkId: lesson.id, spaceId, ...patch }),
      });
      const out = await res.json();
      setSaveError(out.ok ? null : out.reason ?? "could not save");
    } catch {
      setSaveError("could not reach the server");
    }
  };

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const lessonCount = spaces?.reduce((n, s) => n + s.modules.reduce((m, x) => m + x.lessons.length, 0), 0) ?? 0;
  const withImage =
    spaces?.reduce(
      (n, s) => n + s.modules.reduce((m, x) => m + x.lessons.filter((l) => l.assets.imageUrl).length, 0),
      0
    ) ?? 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-xs text-mist">
          {loading
            ? "Reading the lesson spaces from Mighty Networks…"
            : spaces
              ? `${spaces.length} lesson space${spaces.length === 1 ? "" : "s"} · ${lessonCount} lesson${lessonCount === 1 ? "" : "s"} · ${withImage} with an image`
              : null}
        </p>
        <span className="ml-auto flex items-center gap-2">
          {saveError && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ff7a55]">
              <TriangleAlert size={12} /> {saveError}
            </span>
          )}
          <GhostButton onClick={load} tip="Read the lesson spaces again">
            <span className="flex items-center gap-1.5">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </span>
          </GhostButton>
        </span>
      </div>

      {reason ? (
        <div className="card flex items-center gap-2 p-10 text-sm text-mist">
          <TriangleAlert size={15} className="text-[#ff7a55]" /> {reason}
        </div>
      ) : spaces && spaces.length === 0 ? (
        <div className="card p-10 text-center text-sm text-mist">No lesson spaces found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {(spaces ?? []).map((sp) => {
            const n = sp.modules.reduce((m, x) => m + x.lessons.length, 0);
            const isOpen = open.has(sp.id);
            return (
              <section key={sp.id} className="card overflow-hidden">
                <button
                  onClick={() => toggle(sp.id)}
                  className="flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/4"
                >
                  <ChevronRight
                    size={15}
                    className={`shrink-0 text-mist transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{sp.name}</span>
                    <span className="block text-[11px] text-mist">
                      {sp.reason
                        ? sp.reason
                        : `${sp.modules.length} module${sp.modules.length === 1 ? "" : "s"} · ${n} lesson${n === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <a
                    href={sp.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    data-tip="Open this space in Mighty Networks"
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#6ea8ff] hover:underline"
                  >
                    <Link2 size={13} /> space
                  </a>
                </button>

                {isOpen && (
                  <div className="border-l-2 border-[#6ea8ff]/60 bg-white/7 px-5 py-4">
                    {sp.modules.map((m) => (
                      <div key={m.id || "loose"} className="mb-5 last:mb-0">
                        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wider text-mist uppercase">
                          Module · {clean(m.title)}
                          {m.url && (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noreferrer"
                              data-tip="Open this module"
                              className="text-mist hover:text-paper"
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </h3>
                        <div className="flex flex-col gap-2">
                          {m.lessons.map((l) => (
                            <LessonRow
                              key={l.id}
                              lesson={l}
                              onSave={(patch) => save(sp.id, l, patch)}
                            />
                          ))}
                          {m.lessons.length === 0 && (
                            <p className="text-[11px] text-mist">No lessons in this module yet.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function LessonRow({
  lesson,
  onSave,
}: {
  lesson: Lesson;
  onSave: (patch: Partial<Assets>) => void;
}) {
  const a = lesson.assets;
  return (
    <div className="grid gap-x-4 gap-y-2 rounded-lg border border-white/8 bg-navy/40 p-3 lg:grid-cols-[7rem_minmax(0,1fr)]">
      {/* the image: a thumbnail when there is one, a place to paste when not */}
      <div className="flex flex-col gap-1.5">
        {a.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.imageUrl}
            alt=""
            className="aspect-video w-full rounded-md border border-white/10 object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-[#eb320f]/60 text-[#ff7a55]">
            <ImageIcon size={16} />
          </div>
        )}
        <EditableText
          value={a.imageUrl ?? ""}
          placeholder="Image link…"
          invalid={!a.imageUrl}
          onCommit={(v) => onSave({ imageUrl: v.trim() || null })}
          className="text-[11px] text-mist"
        />
      </div>

      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="truncate">{clean(lesson.title)}</span>
          {lesson.status && lesson.status !== "posted" && (
            <span className="shrink-0 rounded bg-white/8 px-1.5 text-[9px] font-bold text-mist uppercase">
              {lesson.status}
            </span>
          )}
          {lesson.url && (
            <a
              href={lesson.url}
              target="_blank"
              rel="noreferrer"
              data-tip="Open this lesson in Mighty Networks"
              className="shrink-0 text-[#6ea8ff] hover:underline"
            >
              <Link2 size={13} />
            </a>
          )}
        </p>
        <div className="mt-1.5 flex items-start gap-2">
          <span className="w-14 shrink-0 pt-1 text-[11px] font-medium text-mist">About</span>
          <EditableText
            value={a.about}
            placeholder="What this lesson is about, in a line or two…"
            multiline
            onCommit={(v) => onSave({ about: v.trim() })}
            className="text-xs"
          />
        </div>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
          {LINKS.map((l) => {
            const value = (a[l.key] as string | null) ?? "";
            return (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className="w-14 shrink-0 text-[11px] font-medium text-mist sm:w-auto">
                  {l.label}
                </span>
                <EditableText
                  value={value}
                  placeholder={l.placeholder}
                  onCommit={(v) => onSave({ [l.key]: v.trim() || null })}
                  className="text-[11px] text-mist"
                />
                {value && (
                  <a
                    href={value}
                    target="_blank"
                    rel="noreferrer"
                    data-tip={`Open the ${l.label.toLowerCase()}`}
                    className="shrink-0 text-mist hover:text-paper"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
