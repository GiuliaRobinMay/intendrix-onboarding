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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_BYTES = 8 * 1024 * 1024;

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

  let bytes: Buffer | null = null;
  let contentType = "";
  let spaceId = "";

  const kind = req.headers.get("content-type") ?? "";
  if (kind.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    spaceId = String(form.get("spaceId") ?? "");
    if (!(file instanceof File))
      return NextResponse.json({ ok: false, reason: "no file" }, { status: 400 });
    if (file.size > MAX_BYTES)
      return NextResponse.json({ ok: false, reason: "that file is over 8 MB" }, { status: 400 });
    contentType = file.type || "application/octet-stream";
    bytes = Buffer.from(await file.arrayBuffer());
  } else {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 });
    }
    const url = String(body?.url ?? "").trim();
    spaceId = String(body?.spaceId ?? "");
    if (!/^https?:\/\//i.test(url))
      return NextResponse.json({ ok: false, reason: "that is not a link" }, { status: 400 });
    let res: Response;
    try {
      res = await fetch(url, { headers: { accept: "image/*" }, cache: "no-store" });
    } catch {
      return NextResponse.json({ ok: false, reason: "could not reach that link" });
    }
    if (!res.ok) return NextResponse.json({ ok: false, reason: `that link answered ${res.status}` });
    contentType = res.headers.get("content-type")?.split(";")[0].trim() || "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES)
      return NextResponse.json({ ok: false, reason: "that image is over 8 MB" });
    bytes = buf;
  }

  if (!contentType.startsWith("image/"))
    return NextResponse.json({ ok: false, reason: `that is not an image (${contentType || "unknown type"})` });
  if (!spaceId) return NextResponse.json({ ok: false, reason: "space required" }, { status: 400 });

  const address = `/api/lesson-image/${encodeURIComponent(id)}`;
  try {
    await pool.query(
      `insert into lesson_images (coursework_id, content_type, bytes, updated_at)
       values ($1, $2, $3, now())
       on conflict (coursework_id) do update
         set content_type = excluded.content_type, bytes = excluded.bytes, updated_at = now()`,
      [id, contentType, bytes]
    );
    await pool.query(
      `insert into lesson_assets (coursework_id, space_id, image_url, updated_at)
       values ($1, $2, $3, now())
       on conflict (coursework_id) do update set image_url = excluded.image_url, updated_at = now()`,
      [id, spaceId, address]
    );
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      reason: /lesson_images|lesson_assets/.test(String(e?.message))
        ? "the database is missing the lesson tables — Settings has the SQL"
        : `could not save — ${String(e?.message ?? e).slice(0, 140)}`,
    });
  }
  return NextResponse.json({ ok: true, imageUrl: address, bytes: bytes.length });
}
