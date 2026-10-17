// /api/lessons — the lesson spaces, their modules and their lessons,
// read from Mighty Networks, with what the team keeps about each
// lesson here: what it is about, its image, and its PDF, video and
// podcast links.
//
// GET  → every lesson space with its tree, each lesson carrying its
//        saved assets.
// PATCH → { courseworkId, spaceId, about?, imageUrl?, pdfUrl?,
//        videoUrl?, podcastUrl? } saves one lesson's assets.
//
// The spaces and the tree are Mighty's; only the assets are ours. A
// lesson is keyed by Mighty's id for it, so a retitle changes nothing.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import {
  fetchCourseworks,
  fetchSpaces,
  mightyConfigured,
  type Coursework,
} from "@/lib/server/mighty";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface LessonAssets {
  about: string;
  imageUrl: string | null;
  pdfUrl: string | null;
  videoUrl: string | null;
  podcastUrl: string | null;
}

async function admin(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok) return { error: NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status }) };
  if (!dbConfigured) return { error: NextResponse.json({ ok: false, reason: "no database" }) };
  const pool = getPool();
  if (who.userId) {
    const profile = await getProfile(pool, who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return { error: NextResponse.json({ ok: false, reason: "Phoenix admins only" }, { status: 403 }) };
  } else if (authEnforced) {
    return { error: NextResponse.json({ ok: false, reason: "sign in first" }, { status: 401 }) };
  }
  return { pool };
}

/** The tree under one space: modules in order, each with its lessons.
 *  Built from parent ids when Mighty gives them; otherwise from order —
 *  a lesson belongs to the module listed before it. */
function tree(items: Coursework[]) {
  const sections = items.filter((c) => c.type === "section");
  const lessons = items.filter((c) => c.type === "lesson" || c.type === "quiz");
  const byParent = new Map<string, Coursework[]>();
  const loose: Coursework[] = [];
  const haveParents = lessons.some((l) => l.parentId && sections.some((s) => s.id === l.parentId));

  if (haveParents) {
    for (const l of lessons) {
      const key = l.parentId && sections.some((s) => s.id === l.parentId) ? l.parentId : "";
      if (key) byParent.set(key, [...(byParent.get(key) ?? []), l]);
      else loose.push(l);
    }
  } else {
    let current = "";
    for (const c of items) {
      if (c.type === "section") current = c.id;
      else if (c.type === "lesson" || c.type === "quiz") {
        if (current) byParent.set(current, [...(byParent.get(current) ?? []), c]);
        else loose.push(c);
      }
    }
  }
  const modules = sections.map((s) => ({
    id: s.id,
    title: s.title,
    url: s.url,
    lessons: byParent.get(s.id) ?? [],
  }));
  if (loose.length) modules.push({ id: "", title: "Lessons", url: null, lessons: loose });
  return modules;
}

export async function GET(req: Request) {
  const gate = await admin(req);
  if ("error" in gate) return gate.error;
  const { pool } = gate;
  if (!mightyConfigured)
    return NextResponse.json({ ok: false, reason: "Mighty Networks is not connected — MIGHTY_API_TOKEN is not set" });

  const spacesOut = await fetchSpaces();
  if (!spacesOut.ok) return NextResponse.json({ ok: false, reason: spacesOut.reason });

  // the lesson spaces sit together under PREP LESSONS; when the API
  // names no group, every space that holds lessons counts
  let lessonSpaces = spacesOut.spaces.filter((s) => /lesson/i.test(s.collection ?? ""));
  const named = lessonSpaces.length > 0;
  if (!named) lessonSpaces = spacesOut.spaces;

  const { rows: assetRows } = await pool
    .query(`select * from lesson_assets`)
    .catch(() => ({ rows: [] as any[] }));
  const assets = new Map<string, LessonAssets>(
    assetRows.map((r: any) => [
      String(r.coursework_id),
      {
        about: r.about ?? "",
        imageUrl: r.image_url ?? null,
        pdfUrl: r.pdf_url ?? null,
        videoUrl: r.video_url ?? null,
        podcastUrl: r.podcast_url ?? null,
      },
    ])
  );

  const spaces = await Promise.all(
    lessonSpaces.map(async (sp) => {
      const out = await fetchCourseworks(sp.id);
      if (!out.ok) return { id: sp.id, name: sp.name, url: sp.url, reason: out.reason, modules: [] };
      const modules = tree(out.items).map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          status: l.status,
          type: l.type,
          assets: assets.get(l.id) ?? {
            about: "",
            imageUrl: null,
            pdfUrl: null,
            videoUrl: null,
            podcastUrl: null,
          },
        })),
      }));
      return { id: sp.id, name: sp.name, url: sp.url, modules };
    })
  );

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    // without a named group, only spaces that actually hold lessons are shown
    spaces: named ? spaces : spaces.filter((s) => s.modules.some((m) => m.lessons.length)),
    assetsTable: assetRows !== undefined,
  });
}

export async function PATCH(req: Request) {
  const gate = await admin(req);
  if ("error" in gate) return gate.error;
  const { pool } = gate;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 });
  }
  const id = String(body?.courseworkId ?? "").trim();
  const spaceId = String(body?.spaceId ?? "").trim();
  if (!id || !spaceId)
    return NextResponse.json({ ok: false, reason: "lesson and space required" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : null);
  const fields: Record<string, string | null> = {};
  if ("about" in body) fields.about = str(body.about) ?? "";
  if ("imageUrl" in body) fields.image_url = str(body.imageUrl) || null;
  if ("pdfUrl" in body) fields.pdf_url = str(body.pdfUrl) || null;
  if ("videoUrl" in body) fields.video_url = str(body.videoUrl) || null;
  if ("podcastUrl" in body) fields.podcast_url = str(body.podcastUrl) || null;
  if (!Object.keys(fields).length)
    return NextResponse.json({ ok: false, reason: "nothing to save" }, { status: 400 });

  const cols = Object.keys(fields);
  const vals = cols.map((c) => fields[c]);
  try {
    await pool.query(
      `insert into lesson_assets (coursework_id, space_id, ${cols.join(", ")}, updated_at)
       values ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(", ")}, now())
       on conflict (coursework_id) do update
         set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}, updated_at = now()`,
      [id, spaceId, ...vals]
    );
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      reason: /lesson_assets/.test(String(e?.message))
        ? "the database is missing the lesson_assets table — Settings has the SQL"
        : `could not save — ${String(e?.message ?? e).slice(0, 140)}`,
    });
  }
  return NextResponse.json({ ok: true });
}
