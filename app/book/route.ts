// /book — the Phoenix coaches, one button each.
//
// A client's idea, carried by Brad: a member should be able to book
// time with their coach from inside the community. This page is made
// to be embedded in the "Schedule a Coaching Call" lesson there, so it
// is a standalone page with no app chrome and no sign-in.
//
// It lists everyone on the Team page who has a scheduling link, with
// the photo from their community profile when there is one. The link
// itself is each coach's own scheduling page (phone call, and Zoom
// where they offer one), so the choice happens there, not here. One
// place to maintain: the Team page.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { fetchCommunityRoster, mightyConfigured } from "@/lib/server/mighty";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Coach {
  name: string;
  role: string | null;
  email: string;
  url: string;
  photo: string | null;
}

/** The coaches to show when the app runs without a database — the
 *  prototype, so the page can be looked at. Never in production. */
const SAMPLE: Coach[] = [
  {
    name: "Brad Zimmerman",
    role: "Phoenix Coach · Owner",
    email: "brad@example.com",
    url: "https://phoenixperform.as.me/BradZimmerman",
    photo: null,
  },
  {
    name: "Kevin Davis",
    role: "Phoenix Coach",
    email: "kevin@example.com",
    url: "https://phoenixperform.as.me/KevinDavis",
    photo: null,
  },
];

// Profile photos come from the community roster, which is a slow read
// of every member. Once an hour is plenty: a photo does not change
// between two views, and a page that waits ten seconds for one is
// worse than a page without it.
let photoCache: { at: number; byEmail: Map<string, string>; byName: Map<string, string> } | null =
  null;
const PHOTO_TTL = 60 * 60 * 1000;

async function photos(): Promise<{ byEmail: Map<string, string>; byName: Map<string, string> }> {
  if (photoCache && Date.now() - photoCache.at < PHOTO_TTL) return photoCache;
  const empty = { byEmail: new Map<string, string>(), byName: new Map<string, string>() };
  if (!mightyConfigured) return empty;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 6000));
  const out = await Promise.race([fetchCommunityRoster(), timeout]).catch(() => null);
  if (!out || !out.ok) return empty;
  const byEmail = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const m of out.members) {
    if (!m.avatarUrl || !/^https:\/\//.test(m.avatarUrl)) continue;
    if (m.email) byEmail.set(m.email.toLowerCase(), m.avatarUrl);
    if (m.name) byName.set(m.name.trim().toLowerCase(), m.avatarUrl);
  }
  photoCache = { at: Date.now(), byEmail, byName };
  return photoCache;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("") || "?";

function page(coaches: Coach[]): NextResponse {
  const cards = coaches
    .map(
      (c) => `<li class="card">
      ${
        c.photo
          ? `<img class="photo" src="${esc(c.photo)}" alt="" loading="lazy"/>`
          : `<span class="photo initials">${esc(initials(c.name))}</span>`
      }
      <p class="name">${esc(c.name)}</p>
      ${c.role ? `<p class="role">${esc(c.role)}</p>` : ""}
      <a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">Schedule a call</a>
    </li>`
    )
    .join("");

  const inner = `<div class="top">
      <div>
        <h1>Schedule a coaching call</h1>
        <p class="sub">Pick your coach. Phone or Zoom, you choose on the next page.</p>
      </div>
      <img class="logo" src="/phoenix-logo.png" alt="Phoenix Performance Partners"/>
    </div>
    ${
      coaches.length
        ? `<ul class="grid">${cards}</ul>`
        : `<div class="empty"><p>No coaches to show yet.</p></div>`
    }
    <p class="foot">Phoenix Performance Partners</p>`;

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Schedule a coaching call</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:#f6f6f8;color:#1a1b2e;
       font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.5}
  .wrap{max-width:860px;margin:0 auto;padding:22px 18px 36px}
  .top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
  .logo{height:38px;width:auto}
  h1{font-size:22px;margin:0 0 3px;letter-spacing:-.01em}
  .sub{color:#6b6c80;font-size:14px;margin:0}
  .grid{list-style:none;margin:0;padding:0;display:grid;gap:14px;
        grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
  .card{background:#fff;border:1px solid #e4e4ea;border-radius:12px;padding:22px 16px 18px;
        text-align:center;display:flex;flex-direction:column;align-items:center}
  .photo{width:84px;height:84px;border-radius:50%;object-fit:cover;display:block;
         background:#eceef5;border:3px solid #fff;box-shadow:0 1px 3px rgba(20,20,40,.12)}
  .initials{display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:26px;color:#51526a;background:#e6e7f0}
  .name{font-weight:700;font-size:15px;margin:12px 0 2px}
  .role{font-size:12px;color:#6b6c80;margin:0}
  .btn{margin-top:14px;display:inline-block;background:#eb320f;color:#fff;text-decoration:none;
       font-size:13px;font-weight:600;padding:9px 16px;border-radius:7px}
  .btn:hover{background:#c92b0d}
  .empty{background:#fff;border:1px solid #e4e4ea;border-radius:12px;padding:26px;
         text-align:center;color:#6b6c80}
  .foot{margin-top:24px;text-align:center;font-size:12px;color:#9a9bab}
</style></head><body><div class="wrap">${inner}</div>
<script>
// Tell the page we are embedded in how tall we are, so the frame can
// grow with the content instead of showing a scrollbar inside a
// scrollbar. Platforms that ignore it keep their fixed height, and the
// page scrolls on its own.
(function(){
  if (window.parent === window) return;
  var last = 0;
  function tell(){
    var h = Math.ceil(document.documentElement.scrollHeight);
    if (Math.abs(h - last) < 8) return;
    last = h;
    try { window.parent.postMessage({ type: 'intendrix:height', height: h }, '*'); } catch (e) {}
  }
  tell();
  window.addEventListener('load', tell);
  if (window.ResizeObserver) new ResizeObserver(tell).observe(document.body);
  setInterval(tell, 1500);
})();
</script>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET() {
  if (!dbConfigured) return page(SAMPLE);

  const pool = getPool();
  // scheduling_url (0026) arrives by hand-run migration; without it
  // there is nobody to show, and the page says so instead of failing
  const { rows } = await pool
    .query(
      `select name, role_title, email, scheduling_url
         from staff
        where scheduling_url is not null and scheduling_url <> ''
        order by created_at, id`
    )
    .catch(() => ({ rows: [] as any[] }));

  const { byEmail, byName } = rows.length
    ? await photos()
    : { byEmail: new Map<string, string>(), byName: new Map<string, string>() };

  const coaches: Coach[] = rows
    .filter((r: any) => /^https?:\/\//.test(String(r.scheduling_url)))
    .map((r: any) => ({
      name: String(r.name),
      role: r.role_title || null,
      email: String(r.email ?? ""),
      url: String(r.scheduling_url),
      photo:
        byEmail.get(String(r.email ?? "").toLowerCase()) ??
        byName.get(String(r.name).trim().toLowerCase()) ??
        null,
    }));

  return page(coaches);
}
