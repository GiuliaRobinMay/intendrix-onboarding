// /api/lesson-image/{courseworkId} — a lesson's image, kept here.
//
// GET  serves the bytes. No sign-in: the address goes into emails and
//      into posts in the community, and a picture that asks the reader
//      to log in is a broken picture.
// POST (Phoenix admins) stores one: a file in a multipart form under
//      "file", or JSON { url, spaceId } and the app fetches it. Either
//      way the lesson's image link then points here.
//
// Copied in rather than linked: a link to somebody else's server breaks
// the day they move the file, and the day that happens is the day a
// lesson email goes out with a blank at the top.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { storeImageBytes, storeImageFromUrl } from "@/lib/server/lesson-images";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!dbConfigured) return new NextResponse(null, { status: 404 });
  const { rows } = await getPool()
    .query(`select content_type, bytes, updated_at from lesson_images where coursework_id = $1`, [id])
    .catch(() => ({ rows: [] as any[] }));
  if (!rows.length) return new NextResponse(null, { status: 404 });
  const row = rows[0];
  return new NextResponse(new Uint8Array(row.bytes as Buffer), {
    headers: {
      "content-type": row.content_type,
      // a new upload is a new byte string under the same address; a day
      // of caching is the most a mail client will hold on to anyway
      "cache-control": "public, max-age=86400",
      "last-modified": new Date(row.updated_at).toUTCString(),
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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

  const kind = req.headers.get("content-type") ?? "";
  let result;
  if (kind.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const spaceId = String(form.get("spaceId") ?? "");
    if (!(file instanceof File))
      return NextResponse.json({ ok: false, reason: "no file" }, { status: 400 });
    if (!spaceId) return NextResponse.json({ ok: false, reason: "space required" }, { status: 400 });
    result = await storeImageBytes(
      pool,
      id,
      spaceId,
      file.type || "application/octet-stream",
      Buffer.from(await file.arrayBuffer())
    );
  } else {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 });
    }
    const spaceId = String(body?.spaceId ?? "");
    if (!spaceId) return NextResponse.json({ ok: false, reason: "space required" }, { status: 400 });
    result = await storeImageFromUrl(pool, id, spaceId, String(body?.url ?? "").trim());
  }
  return NextResponse.json(result);
}
