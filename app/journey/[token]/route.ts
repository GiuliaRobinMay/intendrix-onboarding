// /journey/<token> — a client team's own programme, shown back to them.
//
// Made to be embedded in the team's space in the community, so it is a
// standalone page with no app chrome and no sign-in: its readers are
// the people living the programme, not people running it.
//
// What it shows is what they were actually sent. Not the schedule, not
// the plan — the send log. A lesson appears here once it has left the
// building, which means the page can never promise something that did
// not arrive, and never spoils what is still ahead.
//
// The newest lesson is open. Everything before it is there to walk back
// through. What is still to come is a count and nothing more.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { personalize } from "@/lib/merge";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The body as written, as safe HTML: paragraphs and links, nothing else. */
const bodyHtml = (raw: string) =>
  esc(raw)
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p>${para
          .replace(/\n/g, "<br/>")
          .replace(
            /(https?:\/\/[^\s<]+)/g,
            (u) => `<a href="${u}" target="_blank" rel="noreferrer">${u}</a>`
          )}</p>`
    )
    .join("");

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function shell(title: string, inner: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${esc(title)}</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:#f6f6f8;color:#1a1b2e;
       font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.55}
  .wrap{max-width:720px;margin:0 auto;padding:22px 18px 40px}
  .top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
  .logo{height:38px;width:auto}
  h1{font-size:21px;margin:0 0 2px;letter-spacing:-.01em}
  .sub{color:#6b6c80;font-size:13px;margin:0}
  .count{font-size:12px;color:#6b6c80;white-space:nowrap}

  /* the line everything hangs from */
  ol{list-style:none;margin:0;padding:0;position:relative}
  ol::before{content:"";position:absolute;left:17px;top:10px;bottom:28px;width:2px;background:#e1e1e8}
  li{position:relative;padding:0 0 14px 52px}
  .dot{position:absolute;left:0;top:0;width:36px;height:36px;border-radius:50%;
       display:flex;align-items:center;justify-content:center;
       font-weight:700;font-size:13px;background:#fff;border:2px solid #e1e1e8;color:#8a8b9c}
  li.done .dot{background:#fff;border-color:#c9cad6;color:#51526a}
  li.now  .dot{background:#eb320f;border-color:#eb320f;color:#fff}

  details{background:#fff;border:1px solid #e4e4ea;border-radius:10px;overflow:hidden}
  details[open]{box-shadow:0 1px 3px rgba(20,20,40,.07)}
  summary{cursor:pointer;list-style:none;padding:13px 16px;display:flex;
          align-items:baseline;justify-content:space-between;gap:12px}
  summary::-webkit-details-marker{display:none}
  .t{font-weight:650;font-size:15px}
  .when{font-size:12px;color:#8a8b9c;white-space:nowrap}
  li.now .t{color:#b4260c}
  .inner{padding:0 16px 16px;border-top:1px solid #f0f0f4}
  .subject{font-weight:650;margin:14px 0 8px;font-size:14px}
  .inner p{margin:0 0 11px;font-size:14px}
  .inner a{color:#1a4fd6}
  .links{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
  .links a{display:inline-block;background:#1a1b2e;color:#fff;text-decoration:none;
           font-size:13px;font-weight:600;padding:8px 14px;border-radius:7px}

  .ahead{padding-left:52px;position:relative;color:#8a8b9c;font-size:13px;padding-top:2px}
  .ahead .dot{border-style:dashed}
  .empty{background:#fff;border:1px solid #e4e4ea;border-radius:10px;padding:26px;text-align:center;color:#6b6c80}
  .foot{margin-top:26px;text-align:center;font-size:12px;color:#9a9bab}
</style></head><body><div class="wrap">${inner}</div>
<script>
// Tell the page we are embedded in how tall we are, so the frame can
// grow with the content instead of showing a scrollbar inside a
// scrollbar. Platforms that ignore it simply keep their fixed height,
// and the page scrolls on its own — no worse than before.
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
  document.addEventListener('toggle', function(){ setTimeout(tell, 60); }, true);
  if (window.ResizeObserver) new ResizeObserver(tell).observe(document.body);
  setInterval(tell, 1500);
})();
</script>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

const notFound = () =>
  shell(
    "Not found",
    `<div class="empty"><p>This page is not available.</p></div>`
  );

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!dbConfigured) return notFound();
  const { token } = await params;
  if (!token || token.length < 12) return notFound();

  const pool = getPool();

  const { rows: campaigns } = await pool
    .query(
      `select c.id, c.name, c.code, cl.name as client_name, cl.short_name
         from campaigns c
         join clients cl on cl.id = c.client_id
        where c.share_token = $1`,
      [token]
    )
    .catch(() => ({ rows: [] as any[] }));
  const campaign = campaigns[0];
  if (!campaign) return notFound();

  // What actually went out, oldest first — one row per lesson, however
  // many people received it.
  const { rows: lessons } = await pool
    .query(
      `select s.id, s.title, sr.name as series_name, sr.sort_order as series_order,
              s.sort_order as step_order,
              min(e.sent_at) as first_sent,
              count(*)::int as recipients
         from email_sends e
         join series_steps s on s.id = e.step_id
         join series_templates sr on sr.id = s.series_template_id
        where e.campaign_id = $1 and e.status = 'sent' and e.shadow_to is null
        group by s.id, s.title, sr.name, sr.sort_order, s.sort_order
        order by min(e.sent_at)`,
      [campaign.id]
    )
    .catch(() => ({ rows: [] as any[] }));

  if (lessons.length === 0)
    return shell(
      `${campaign.client_name} · ${campaign.name}`,
      `<div class="top">
         <div><h1>${esc(campaign.name)}</h1>
         <p class="sub">${esc(campaign.client_name)}</p></div>
         <img class="logo" src="/phoenix-logo.png" alt=""/>
       </div>
       <div class="empty"><p>Your first lesson is on its way.<br/>
       This page fills itself as the programme unfolds.</p></div>`
    );

  // the words each lesson went out with: this campaign's own version
  // when it has one, otherwise the master
  const stepIds = lessons.map((l: any) => l.id);
  const [{ rows: contents }, { rows: overrides }] = await Promise.all([
    pool.query(
      `select step_id, email_subject, email_body, lesson_label, lesson_url,
              attachment_label, attachment_url
         from step_contents
        where step_id = any($1) and variant = 'participant'`,
      [stepIds]
    ),
    pool
      .query(
        `select step_id, email_subject, email_body
           from campaign_step_content
          where campaign_id = $1 and step_id = any($2) and variant = 'participant'`,
        [campaign.id, stepIds]
      )
      .catch(() => ({ rows: [] as any[] })),
  ]);
  const base = new Map(contents.map((c: any) => [c.step_id, c]));
  const own = new Map(overrides.map((c: any) => [c.step_id, c]));

  // how many lessons this campaign holds altogether, so "still to come"
  // is a real number rather than a shrug
  const { rows: totals } = await pool
    .query(
      `select count(*)::int as n
         from campaign_series cs
         join series_steps s on s.series_template_id = cs.series_template_id
        where cs.campaign_id = $1
          and not exists (select 1 from campaign_step_skips k
                           where k.campaign_id = cs.campaign_id and k.step_id = s.id)`,
      [campaign.id]
    )
    .catch(() => ({ rows: [{ n: lessons.length }] }));
  const total = Math.max(totals[0]?.n ?? lessons.length, lessons.length);
  const ahead = total - lessons.length;

  const merge = { firstName: "", client: campaign.client_name };
  const clean = (t: string) =>
    personalize(t ?? "", merge).replace(/\s*,?\s*\bthere\b/gi, "").trimStart();

  const items = lessons
    .map((l: any, i: number) => {
      const b = base.get(l.id) ?? {};
      const o = own.get(l.id) ?? {};
      const subject = clean(o.email_subject ?? b.email_subject ?? l.title);
      const body = clean(o.email_body ?? b.email_body ?? "");
      const newest = i === lessons.length - 1;
      const when = l.first_sent ? fmtDate(new Date(l.first_sent)) : "";
      const links = [
        b.lesson_url
          ? `<a href="${esc(b.lesson_url)}" target="_blank" rel="noreferrer">${esc(
              b.lesson_label || "Open the lesson"
            )}</a>`
          : "",
        b.attachment_url
          ? `<a href="${esc(b.attachment_url)}" target="_blank" rel="noreferrer">${esc(
              b.attachment_label || "Download"
            )}</a>`
          : "",
      ]
        .filter(Boolean)
        .join("");

      return `<li class="${newest ? "now" : "done"}">
        <span class="dot">${i + 1}</span>
        <details${newest ? " open" : ""}>
          <summary><span class="t">${esc(l.title)}</span><span class="when">${esc(when)}</span></summary>
          <div class="inner">
            <p class="subject">${esc(subject)}</p>
            ${bodyHtml(body)}
            ${links ? `<div class="links">${links}</div>` : ""}
          </div>
        </details>
      </li>`;
    })
    .join("");

  return shell(
    `${campaign.client_name} · ${campaign.name}`,
    `<div class="top">
       <div>
         <h1>${esc(campaign.name)}</h1>
         <p class="sub">${esc(campaign.client_name)}</p>
       </div>
       <img class="logo" src="/phoenix-logo.png" alt="Phoenix Performance Partners"/>
     </div>
     <p class="count">${lessons.length} of ${total} lessons so far</p>
     <ol>${items}</ol>
     ${
       ahead > 0
         ? `<div class="ahead"><span class="dot">+</span>${ahead} more still to come</div>`
         : ""
     }
     <p class="foot">Your Transformational Leadership Experience</p>`
  );
}
