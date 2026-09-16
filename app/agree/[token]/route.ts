// /agree/<token> — the public user-agreement page. GET shows the full
// agreement, personal to the member behind the token; POST records the
// acceptance with timestamp, IP address, browser, and the version of
// the text that was shown — the proof. After accepting, the page hands
// over the member's personal link into the community: nobody proceeds
// without agreeing first.
//
// Served as a standalone HTML page (no app chrome, no sign-in) because
// its readers are program members, not app users.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import {
  AGREEMENT_TEXT,
  AGREEMENT_TITLE,
  AGREEMENT_VERSION,
} from "@/lib/agreement";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function page(inner: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${esc(AGREEMENT_TITLE)}</title>
<style>
  body{margin:0;background:#f4f4f6;color:#1a1b2e;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;}
  .wrap{max-width:680px;margin:0 auto;padding:32px 20px 120px;}
  .card{background:#fff;border:1px solid #e4e4e8;border-radius:10px;padding:32px;}
  h1{font-size:22px;margin:0 0 4px;}
  .sub{color:#5f6170;font-size:13px;margin:0 0 20px;}
  .lead{font-size:14px;line-height:1.6;color:#2a2b3e;background:#f4f4f6;border-radius:8px;padding:14px 16px;margin:0 0 22px;}
  .text{white-space:pre-wrap;font-size:14px;line-height:1.65;color:#2a2b3e;}
  .bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e4e4e8;padding:14px 20px;box-shadow:0 -4px 16px rgba(0,0,0,.06);}
  .barin{max-width:680px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .barin p{margin:0;font-size:12px;color:#5f6170;}
  .chk{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:#1a1b2e;cursor:pointer;margin-top:24px;padding-top:18px;border-top:1px solid #e4e4e8;}
  .chk input{width:18px;height:18px;flex:none;accent-color:#2c2d83;cursor:pointer;}
  button,.btn{background:#2c2d83;color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:600;padding:12px 28px;cursor:pointer;text-decoration:none;display:inline-block;}
  button:disabled{opacity:.5;cursor:default;}
  .ok{color:#15803d;font-weight:600;}
  .err{color:#b91c1c;font-weight:600;}
</style></head><body>${inner}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

async function memberByToken(token: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `select m.id, m.name, m.first_name, m.agreement_signed_at,
            c.name as client_name, c.invite_url
       from members m join clients c on c.id = m.client_id
      where m.agreement_token = $1`,
    [token]
  );
  return rows[0] ?? null;
}

const joinBlock = (inviteUrl: string | null, clientName: string) =>
  inviteUrl
    ? `<p style="margin:18px 0 0;"><a class="btn" href="${esc(inviteUrl)}">Join the ${esc(clientName)} community &rarr;</a></p>`
    : "";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // the read-only preview a test email's button opens — full text,
  // nothing to click, nothing recorded
  if (token === "preview")
    return page(`<div class="wrap"><div class="card">
      <h1>${esc(AGREEMENT_TITLE)}</h1>
      <p class="sub">Preview &middot; version ${AGREEMENT_VERSION}</p>
      <div class="text">${esc(AGREEMENT_TEXT)}</div>
    </div></div>
    <div class="bar"><div class="barin">
      <p>This is a preview. Each member gets their own personal link, where their I&nbsp;Agree is recorded.</p>
    </div></div>`);

  if (!dbConfigured || !/^[a-f0-9]{24,64}$/.test(token))
    return page(`<div class="wrap"><div class="card"><h1>This link is not valid</h1>
      <p class="sub">Ask the person who sent it for a fresh one.</p></div></div>`);

  const m = await memberByToken(token);
  if (!m)
    return page(`<div class="wrap"><div class="card"><h1>This link is not valid</h1>
      <p class="sub">Ask the person who sent it for a fresh one.</p></div></div>`);

  if (m.agreement_signed_at) {
    const when = new Date(m.agreement_signed_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return page(`<div class="wrap"><div class="card">
      <h1>You are all set, ${esc(m.first_name ?? m.name)}</h1>
      <p class="sub">You accepted the Intendrix user agreement on ${when}.</p>
      ${joinBlock(m.invite_url, m.client_name)}
    </div></div>`);
  }

  return page(`<div class="wrap"><div class="card">
    <h1>${esc(AGREEMENT_TITLE)}</h1>
    <p class="sub">For ${esc(m.name)} &middot; ${esc(m.client_name)} &middot; version ${AGREEMENT_VERSION}</p>
    <p class="lead">Please read the agreement below. Nothing is recorded until you tick
      the box at the end and click <strong>I&nbsp;Agree</strong>. You can close this page and
      come back to it later — the link stays yours.</p>
    <div class="text">${esc(AGREEMENT_TEXT)}</div>
    <label class="chk"><input type="checkbox" id="tick"/>
      <span>I have read this agreement and I agree to its terms.</span>
    </label>
  </div></div>
  <div class="bar"><div class="barin">
    <p id="hint">Read the agreement and tick the box at the end — that unlocks this button. Your acceptance is recorded.</p>
    <span id="slot"><button id="agree" disabled>I Agree</button></span>
  </div></div>
  <script>
  document.getElementById('tick').addEventListener('change', function(){
    document.getElementById('agree').disabled = !this.checked;
    document.getElementById('hint').textContent = this.checked
      ? 'One click left.'
      : 'Read the agreement and tick the box at the end — that unlocks this button. Your acceptance is recorded.';
  });
  document.getElementById('agree').addEventListener('click', async function(){
    this.disabled = true; this.textContent = 'One moment…';
    try {
      var r = await fetch(location.pathname, {method:'POST'});
      var out = await r.json();
      if (out.ok) {
        var s = document.getElementById('slot');
        s.innerHTML = out.joinUrl
          ? '<span class="ok">Accepted &#10003;</span>&nbsp;&nbsp;<a class="btn" href="' + out.joinUrl + '">Join the community &rarr;</a>'
          : '<span class="ok">Accepted &#10003; You are all set.</span>';
      } else {
        this.outerHTML = '<span class="err">Something went wrong — refresh and try again.</span>';
      }
    } catch (e) {
      this.outerHTML = '<span class="err">Something went wrong — refresh and try again.</span>';
    }
  });
  </script>`);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!dbConfigured || !/^[a-f0-9]{24,64}$/.test(token))
    return NextResponse.json({ ok: false }, { status: 400 });

  const pool = getPool();
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 300) || null;

  // first click records; any later click is a harmless repeat
  await pool.query(
    `update members
        set agreement_signed_at = now(),
            agreement_version = $2,
            agreement_ip = $3,
            agreement_user_agent = $4
      where agreement_token = $1
        and agreement_signed_at is null`,
    [token, AGREEMENT_VERSION, ip, userAgent]
  );

  const m = await memberByToken(token);
  if (!m || !m.agreement_signed_at)
    return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, joinUrl: m.invite_url ?? null });
}
