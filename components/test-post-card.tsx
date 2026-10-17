"use client";

// One trial post into the testers' space, from Settings.
//
// Two questions the API's spec does not answer: does an image in the
// body of a post made this way stay in, and does such a post notify the
// members of the space. One post in "App Testers — Do Not Delete"
// answers both — look at it in Mighty Networks, then take it down here.

import { useState } from "react";
import { ExternalLink, FlaskConical, Trash2 } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { GhostButton, GradientButton } from "@/components/ui";

interface Made {
  id: string;
  url: string | null;
  images: string[];
  space: string;
}

export function TestPostCard() {
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/test-post", { method: "POST", headers: await authHeaders() });
      const out = await res.json();
      if (out.ok) setMade(out);
      else setNote(out.reason ?? "could not make the post");
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!made) return;
    setBusy(true);
    try {
      const res = await fetch("/api/test-post", {
        method: "DELETE",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ id: made.id }),
      });
      const out = await res.json();
      if (out.ok) {
        setMade(null);
        setNote("Deleted.");
      } else setNote(out.reason ?? "could not delete the post");
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <FlaskConical size={17} className="text-mist" />
        Test post to Mighty Networks
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-mist">
        Makes one article in <strong>App Testers — Do Not Delete</strong> with an image at the
        top. Open it there and check two things: is the image showing, and did the testers get
        a notification. Then delete it here.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!made ? (
          <GradientButton onClick={send} disabled={busy}>
            {busy ? "Posting…" : "Send a test post"}
          </GradientButton>
        ) : (
          <>
            {made.url && (
              <a
                href={made.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-[13px] font-semibold text-[#6ea8ff] hover:underline"
              >
                <ExternalLink size={13} /> Open the post
              </a>
            )}
            <GhostButton onClick={remove} tip="Take the test post down">
              <span className="flex items-center gap-1.5">
                <Trash2 size={13} /> {busy ? "Deleting…" : "Delete it"}
              </span>
            </GhostButton>
          </>
        )}
      </div>

      {made && (
        <p className="mt-3 text-[11px] leading-relaxed text-mist">
          Post {made.id} in space {made.space}.{" "}
          {made.images.length
            ? `Mighty reports ${made.images.length} image${made.images.length === 1 ? "" : "s"} on it — the picture came through.`
            : "Mighty reports no image on it — look at the post itself before deciding; the list may simply be empty in the answer."}
        </p>
      )}
      {note && <p className="mt-3 text-[11px] font-semibold text-[#ff7a55]">{note}</p>}
    </section>
  );
}
