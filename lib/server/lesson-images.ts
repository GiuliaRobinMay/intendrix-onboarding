// Copying a lesson's image in.
//
// The bytes come from a link — Mighty's own image for the lesson, its
// space's banner, or anything a person pastes — and are kept in the
// database under the lesson's id. The lesson then points at the app's
// own address for them, which is the address that goes into emails and
// posts: one that stays up.

import type { Pool } from "pg";

const MAX_BYTES = 8 * 1024 * 1024;

export type StoreResult =
  | { ok: true; imageUrl: string; bytes: number }
  | { ok: false; reason: string };

export const lessonImageAddress = (courseworkId: string) =>
  `/api/lesson-image/${encodeURIComponent(courseworkId)}`;

/** Keep these bytes as the lesson's image and point the lesson at them. */
export async function storeImageBytes(
  pool: Pool,
  courseworkId: string,
  spaceId: string,
  contentType: string,
  bytes: Buffer
): Promise<StoreResult> {
  if (!contentType.startsWith("image/"))
    return { ok: false, reason: `that is not an image (${contentType || "unknown type"})` };
  if (bytes.length > MAX_BYTES) return { ok: false, reason: "that image is over 8 MB" };
  const address = lessonImageAddress(courseworkId);
  try {
    await pool.query(
      `insert into lesson_images (coursework_id, content_type, bytes, updated_at)
       values ($1, $2, $3, now())
       on conflict (coursework_id) do update
         set content_type = excluded.content_type, bytes = excluded.bytes, updated_at = now()`,
      [courseworkId, contentType, bytes]
    );
    await pool.query(
      `insert into lesson_assets (coursework_id, space_id, image_url, updated_at)
       values ($1, $2, $3, now())
       on conflict (coursework_id) do update set image_url = excluded.image_url, updated_at = now()`,
      [courseworkId, spaceId, address]
    );
  } catch (e: any) {
    return {
      ok: false,
      reason: /lesson_images|lesson_assets/.test(String(e?.message))
        ? "the database is missing the lesson tables — Settings has the SQL"
        : `could not save — ${String(e?.message ?? e).slice(0, 140)}`,
    };
  }
  return { ok: true, imageUrl: address, bytes: bytes.length };
}

/** Fetch an image from a link and keep it as the lesson's. */
export async function storeImageFromUrl(
  pool: Pool,
  courseworkId: string,
  spaceId: string,
  url: string
): Promise<StoreResult> {
  if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "that is not a link" };
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "image/*" }, cache: "no-store" });
  } catch {
    return { ok: false, reason: "could not reach that link" };
  }
  if (!res.ok) return { ok: false, reason: `that link answered ${res.status}` };
  const contentType = res.headers.get("content-type")?.split(";")[0].trim() || "";
  const bytes = Buffer.from(await res.arrayBuffer());
  return storeImageBytes(pool, courseworkId, spaceId, contentType, bytes);
}
