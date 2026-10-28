// /api/test-post — one article into the testers' space, and out again.
//
// The spec says a post's body may hold bold and italic and nothing
// else: no images, no links. But events and polls take an `images`
// list of addresses in the same API, posts answer with one, and
// Zapier's "Create Quick Post" has an Image URL field — so posts very
// likely take an undocumented `images` list too. This tries the likely
// shapes in order, in "App Testers — Do Not Delete", and says which one
// Mighty accepted. POST makes it; DELETE takes it down.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { createPost, deletePost, mightyConfigured, uploadAsset } from "@/lib/server/mighty";
import { SPACE_BANNERS } from "@/lib/space-banners";

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

  const banner = SPACE_BANNERS["23014040"];
  const when = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const title = `Intendrix test post — ${when}`;
  const body =
    `<p><strong>S1 M1 · Start living by design, not default.</strong></p>` +
    `<p>A test post made by the Intendrix app, to learn how a picture gets onto a post. It will be deleted from the app. Nothing to do.</p>` +
    `<p>https://intendrix.ai/spaces/23014040</p>`;

  const tried: string[] = [];
  const attempt = async (
    name: string,
    input: { postType: string; images: string[] }
  ) => {
    const out = await createPost({
      spaceId: TEST_SPACE,
      title,
      description: body,
      postType: input.postType,
      images: input.images,
      notify: false,
    });
    if (out.ok) return { name, post: out.post };
    tried.push(`${name}: ${out.reason}`);
    return null;
  };

  // A and B: the address straight in an images list, as events take it
  let made = await attempt("article + images[banner address]", { postType: "article", images: [banner] });
  if (!made) made = await attempt("post + images[banner address]", { postType: "post", images: [banner] });

  // C and D: Mighty keeps its own copy first, then the post names that
  if (!made) {
    const up = await uploadAsset({ sourceUrl: banner, style: "post", mainImage: true });
    if (!up.ok) tried.push(`asset upload: ${up.reason}`);
    else {
      tried.push(`asset upload: ok — id ${up.asset.id}, url ${up.asset.url ?? "(none given)"}`);
      const ref = up.asset.url ?? up.asset.id;
      made = await attempt("article + images[Mighty asset]", { postType: "article", images: [ref] });
      if (!made) made = await attempt("post + images[Mighty asset]", { postType: "post", images: [ref] });
    }
  }

  // E: words only, so there is at least a post to look at and delete
  if (!made) made = await attempt("article, no image", { postType: "article", images: [] });
  if (!made) return NextResponse.json({ ok: false, reason: tried.join(" · ") });

  return NextResponse.json({
    ok: true,
    attempt: made.name,
    id: made.post.id,
    url: made.post.url,
    images: made.post.images,
    space: TEST_SPACE,
    tried,
    raw: made.post.raw,
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
