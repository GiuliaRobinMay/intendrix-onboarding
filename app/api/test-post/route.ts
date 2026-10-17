// /api/test-post — one article into the testers' space, and out again.
//
// Two things nobody can know from the spec: whether an image in the
// body of a post made through the API is kept, and whether such a post
// notifies the members of the space. One post in "App Testers — Do Not
// Delete" answers both. POST makes it; DELETE takes it down.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { createPost, deletePost, mightyConfigured } from "@/lib/server/mighty";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The testers' space — the one place a trial post harms nobody. */
const TEST_SPACE = process.env.MIGHTY_TEST_SPACE_ID?.trim() || "22683411";

async function gate(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok) return NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status });
  if (who.userId && dbConfigured) {
    const profile = await getProfile(getPool(), who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return NextResponse.json({ ok: false, reason: "Phoenix admins only" }, { status: 403 });
  } else if (authEnforced) {
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: 401 });
  }
  if (!mightyConfigured)
    return NextResponse.json({ ok: false, reason: "Mighty Networks is not connected — MIGHTY_API_TOKEN is not set" });
  return null;
}

export async function POST(req: Request) {
  const refused = await gate(req);
  if (refused) return refused;

  // The API refuses images and links in a post's body — only bold and
  // italic get through. What is left to learn: whether a bare address
  // in plain text is kept, and whether Mighty makes it clickable.
  const when = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const out = await createPost({
    spaceId: TEST_SPACE,
    title: `Intendrix test post — ${when}`,
    postType: "article",
    description:
      `<p><strong>S1 M1 · Start living by design, not default.</strong></p>` +
      `<p>This is a test post made by the Intendrix app. It checks whether a plain web address below shows up as something you can click, and whether making a post this way notifies the members of the space.</p>` +
      `<p>https://intendrix.ai/spaces/23014040</p>` +
      `<p><em>It will be deleted from the app. Nothing to do.</em></p>`,
  });
  if (!out.ok) return NextResponse.json({ ok: false, reason: out.reason });
  return NextResponse.json({
    ok: true,
    id: out.post.id,
    url: out.post.url,
    images: out.post.images,
    space: TEST_SPACE,
    // the whole answer, so a field named differently than expected is
    // still there to read
    raw: out.post.raw,
  });
}

export async function DELETE(req: Request) {
  const refused = await gate(req);
  if (refused) return refused;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 });
  }
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, reason: "post id required" }, { status: 400 });
  const out = await deletePost(id);
  return NextResponse.json(out.ok ? { ok: true } : { ok: false, reason: out.reason });
}
