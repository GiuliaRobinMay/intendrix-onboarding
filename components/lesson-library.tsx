"use client";

// The lesson spaces, their modules and their lessons — read from
// Mighty Networks — with what the team keeps about each lesson here.
//
// Mighty holds the lessons themselves. What it does not hold is the
// material that goes out ABOUT a lesson: a line saying what it is
// about, the image for a post or the top of an email, the PDF, the
// video, the podcast. That lives here, one row per lesson, typed in
// place, and is what the emails and the Phoenix Updates posts draw on.

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { EditableText } from "@/components/editable";
import { GhostButton } from "@/components/ui";

interface Assets {
  /** S1 M1 — printed on the lesson's PDF */
  code: string | null;
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
  /** what Mighty's own lesson text suggests, for fields still empty */
  suggested: { code: string; pdfUrl: string | null; imageUrl: string | null };
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
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // every lesson without an image gets one: its own from Mighty's text
  // when there is one, its space's banner otherwise — copied in and kept
  const copyAll = async () => {
    setCopying(true);
    setCopied(null);
    try {
      const res = await fetch("/api/lessons/copy-images", {
        method: "POST",
        headers: await authHeaders(),
      });
      const out = await res.json();
      if (!out.ok) setCopied(out.reason ?? "could not copy the images");
      else
        setCopied(
          `${out.stored} copied in` +
            (out.already ? ` · ${out.already} already had one` : "") +
            (out.none ? ` · ${out.none} with nothing to copy` : "") +
            (out.failed?.length ? ` · ${out.failed.length} failed: ${out.failed[0]}` : "")
        );
      await load();
    } catch {
      setCopied("could not reach the server");
    } finally {
      setCopying(false);
    }
  };

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

  // an image is copied in — a file from the disk, or a link the server
  // fetches — and the lesson then points at the app's own copy
  const storeImage = async (
    spaceId: string,
    lesson: Lesson,
    source: { file: File } | { url: string }
  ) => {
    try {
      const headers = await authHeaders();
      let res: Response;
      if ("file" in source) {
        const form = new FormData();
        form.append("file", source.file);
        form.append("spaceId", spaceId);
        res = await fetch(`/api/lesson-image/${encodeURIComponent(lesson.id)}`, {
          method: "POST",
          headers,
          body: form,
        });
      } else {
        res = await fetch(`/api/lesson-image/${encodeURIComponent(lesson.id)}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ url: source.url, spaceId }),
        });
      }
      const out = await res.json();
      if (!out.ok) {
        setSaveError(out.reason ?? "could not store the image");
        return;
      }
      setSaveError(null);
      // the same address, new bytes — a stamp makes the browser look again
      const fresh = `${out.imageUrl}?v=${Date.now()}`;
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
                        l.id === lesson.id ? { ...l, assets: { ...l.assets, imageUrl: fresh } } : l
                      ),
                    })),
                  }
            )
          : all
      );
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
          {copied && <span className="text-[11px] text-mist">{copied}</span>}
          <GhostButton
            onClick={copyAll}
            tip="For every lesson without an image: take the image from its own text in Mighty Networks, or its space's banner, and keep a copy here. Lessons that have one are left alone."
          >
            <span className="flex items-center gap-1.5">
              <ImageIcon size={13} className={copying ? "animate-pulse" : ""} />
              {copying ? "Copying…" : "Copy images from Mighty Networks"}
            </span>
          </GhostButton>
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
                              onImage={(source) => storeImage(sp.id, l, source)}
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
  onImage,
}: {
  lesson: Lesson;
  onSave: (patch: Partial<Assets>) => void;
  onImage: (source: { file: File } | { url: string }) => void;
}) {
  const a = lesson.assets;
  const fileRef = useRef<HTMLInputElement>(null);
  const [copying, setCopying] = useState(false);
  // the label column is one width everywhere, so About, PDF and the
  // image's own line all start on the same vertical
  const label = "w-14 shrink-0 text-[11px] font-medium text-mist";

  return (
    <div className="grid gap-x-4 gap-y-2 rounded-lg border border-white/8 bg-navy/40 p-3 lg:grid-cols-[9rem_minmax(0,1fr)]">
      {/* the image: the app's own copy once there is one */}
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
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImage({ file: f });
            e.target.value = "";
          }}
        />
        <div className="flex gap-1">
          <button
            data-tip="Upload an image from your computer — it is kept here"
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
          >
            <Upload size={11} /> Upload
          </button>
          <button
            data-tip="Paste a link to an image — the app copies it in and keeps its own"
            onClick={() => setCopying((v) => !v)}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-mist transition-colors hover:border-white/25 hover:text-paper"
          >
            <Link2 size={11} /> Copy
          </button>
        </div>
        {copying && (
          <EditableText
            value=""
            placeholder={lesson.suggested.imageUrl ?? "Paste an image link…"}
            onCommit={(v) => {
              const url = v.trim() || lesson.suggested.imageUrl || "";
              if (url) onImage({ url });
              setCopying(false);
            }}
            className="text-[11px] text-mist"
          />
        )}
      </div>

      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="w-14 shrink-0">
            <EditableText
              value={a.code ?? ""}
              placeholder={lesson.suggested.code}
              onCommit={(v) => onSave({ code: v.trim() || null })}
              className="text-[11px] font-bold text-[#a3a4f0]"
            />
          </span>
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
          <span className={`${label} pt-1`}>About</span>
          <EditableText
            value={a.about}
            placeholder="What this lesson is about, in a line or two…"
            multiline
            onCommit={(v) => onSave({ about: v.trim() })}
            className="text-xs"
          />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LINKS.map((l, i) => {
            const value = (a[l.key] as string | null) ?? "";
            const hint = l.key === "pdfUrl" ? lesson.suggested.pdfUrl : null;
            return (
              <div key={l.key} className={`flex min-w-0 items-center gap-2 ${i === 0 ? "w-full sm:w-auto sm:flex-1" : "flex-1"}`}>
                <span className={i === 0 ? label : "shrink-0 text-[11px] font-medium text-mist"}>
                  {l.label}
                </span>
                <EditableText
                  value={value}
                  placeholder={hint ?? l.placeholder}
                  onCommit={(v) => onSave({ [l.key]: (v.trim() || hint || "") || null })}
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
