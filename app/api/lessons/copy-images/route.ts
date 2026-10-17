// POST /api/lessons/copy-images — an image for every lesson that has none.
//
// Mighty's lesson record carries no image field, but a lesson's text
// often does, and every lesson space has a banner. So, for each lesson
// without a stored image: the first image in its own text when there is
// one, its space's banner otherwise — fetched and kept here. A lesson
// that already has an image is left alone; this never overwrites.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { fetchCourseworks, fetchSpaces, mightyConfigured } from "@/lib/server/mighty";
import { storeImageFromUrl } from "@/lib/server/lesson-images";
import { SPACE_BANNERS } from "@/lib/space-banners";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status });
  if (!dbConfigured) return NextResponse.json({ ok: false, reason: "no database" });
  const pool = getPool();
  if (who.userId) {
    const profile = await getProfile(pool, who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return NextResponse.json({ ok: false, reason: "Phoenix admins only" }, { status: 403 });
  } else if (authEnforced) {
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: 401 });
  }
  if (!mightyConfigured)
    return NextResponse.json({ ok: false, reason: "Mighty Networks is not connected — MIGHTY_API_TOKEN is not set" });

  const spacesOut = await fetchSpaces();
  if (!spacesOut.ok) return NextResponse.json({ ok: false, reason: spacesOut.reason });
  let lessonSpaces = spacesOut.spaces.filter((s) => /lesson/i.test(s.collection ?? ""));
  if (!lessonSpaces.length)
    lessonSpaces = spacesOut.spaces.filter(
      (s) => !/welcome|member guide|template|tester|host hub|bombbomb/i.test(s.name)
    );

  const { rows } = await pool
    .query(`select coursework_id from lesson_images`)
    .catch(() => ({ rows: null as any }));
  if (!rows)
    return NextResponse.json({
      ok: false,
      reason: "the database is missing the lesson_images table — Settings has the SQL",
    });
  const have = new Set(rows.map((r: any) => String(r.coursework_id)));

  let stored = 0;
  let already = 0;
  let none = 0;
  const failed: string[] = [];

  for (const sp of lessonSpaces) {
    const out = await fetchCourseworks(sp.id);
    if (!out.ok) {
      failed.push(`${sp.name}: ${out.reason}`);
      continue;
    }
    for (const l of out.items) {
      if (l.type !== "lesson" && l.type !== "quiz") continue;
      if (have.has(l.id)) {
        already++;
        continue;
      }
      const own = (l.description ?? "").match(/<img[^>]+src=["'](https?:[^"']+)["']/i)?.[1];
      const source = own ?? SPACE_BANNERS[sp.id] ?? null;
      if (!source) {
        none++;
        continue;
      }
      const res = await storeImageFromUrl(pool, l.id, sp.id, source);
      if (res.ok) stored++;
      else failed.push(`${l.title}: ${res.reason}`);
    }
  }

  return NextResponse.json({ ok: true, stored, already, none, failed: failed.slice(0, 20) });
}
