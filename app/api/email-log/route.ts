// GET /api/email-log?q=…&scope=all|trouble|notsent&limit=300
//
// Every email the engine ever sent, one row per person per send, newest
// first, searchable by whatever you happen to know: a name, an address,
// a company, a campaign code, a lesson title.
//
// It exists because the question arrives from the other direction. A
// person writes "I never got it" — not "lesson 1.4 of the Brio POEA
// campaign was not delivered to me". Answering used to mean guessing
// which campaign, opening it, finding the lesson and reading down a
// list. Here you type their name.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ error: "sign in first" }, { status: who.status });
  if (!dbConfigured) return NextResponse.json({ rows: [], total: 0 });

  const pool = getPool();
  if (who.userId) {
    const profile = await getProfile(pool, who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return NextResponse.json({ error: "Phoenix admins only" }, { status: 403 });
  } else if (authEnforced) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const scope = url.searchParams.get("scope") ?? "all";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 300) || 300, 1),
    2000
  );

  // the search is one pattern against everything a person might
  // remember, so "brio", "todd", "@acme.com" and "1.4" all work
  const params: any[] = [];
  const where: string[] = [];
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(`(
      coalesce(m.name, '') ilike ${p}
      or coalesce(m.email, '') ilike ${p}
      or coalesce(e.shadow_to, '') ilike ${p}
      or cl.name ilike ${p}
      or coalesce(cl.short_name, '') ilike ${p}
      or c.name ilike ${p}
      or coalesce(c.code, '') ilike ${p}
      or coalesce(ss.title, '') ilike ${p}
      or coalesce(ss.code, '') ilike ${p}
    )`);
  }

  // The engine writes one row when it refuses to send — held, failed —
  // and a hand send afterwards writes a fresh "sent" row rather than
  // touching the old one. So the refusal stays in the log next to the
  // send that answered it. That is the right record, but it is not an
  // email still waiting, and "Not sent" must not list it as one.
  const SUPERSEDED = `exists (
      select 1 from email_sends s
       where s.campaign_id = e.campaign_id
         and s.step_id = e.step_id
         and s.status = 'sent'
         and s.id <> e.id
         and (s.member_id = e.member_id
              or (e.shadow_to is not null and s.shadow_to = e.shadow_to)))`;

  const build = (withEvents: boolean) => {
    const w = [...where];
    if (scope === "trouble")
      w.push(
        withEvents
          ? `(e.status = 'failed' or e.last_event in ('bounced','complained','failed'))`
          : `e.status = 'failed'`
      );
    else if (scope === "notsent") w.push(`e.sent_at is null and not ${SUPERSEDED}`);

    params.push(limit);
    const sql = `
      select e.id,
             coalesce(m.name, e.shadow_to) as name,
             coalesce(e.shadow_to, m.email) as email,
             (e.shadow_to is not null) as is_copy,
             m.id as member_id,
             cl.id as client_id, cl.name as client_name, cl.short_name as client_short,
             c.id as campaign_id, c.name as campaign_name, c.code as campaign_code, c.timezone,
             ss.code as step_code, ss.title as step_title,
             e.status, e.error, e.scheduled_for, e.sent_at,
             (e.sent_at is null and ${SUPERSEDED}) as superseded
             ${withEvents ? ", e.last_event, e.last_event_at" : ""},
             count(*) over () as total
        from email_sends e
        join campaigns c on c.id = e.campaign_id
        join clients cl on cl.id = c.client_id
        left join members m on m.id = e.member_id
        left join series_steps ss on ss.id = e.step_id
       ${w.length ? `where ${w.join(" and ")}` : ""}
       order by coalesce(e.sent_at, e.scheduled_for) desc
       limit $${params.length}`;
    return pool.query(sql, params);
  };

  // a database from before the delivery-status columns still answers
  let rows: any[];
  try {
    rows = (await build(true)).rows;
  } catch {
    params.length = 0;
    if (q) params.push(`%${q}%`);
    rows = (await build(false)).rows;
  }

  return NextResponse.json({
    total: rows.length ? Number(rows[0].total) : 0,
    rows: rows.map((r: any) => ({
      id: r.id,
      name: r.name ?? "(removed)",
      email: r.email ?? "",
      copy: r.is_copy,
      memberId: r.member_id ?? null,
      clientId: r.client_id,
      client: r.client_short || r.client_name,
      campaignId: r.campaign_id,
      campaign: r.campaign_name,
      campaignCode: r.campaign_code,
      timezone: r.timezone ?? "America/New_York",
      lesson: r.step_title ?? r.step_code ?? "lesson",
      lessonCode: r.step_code ?? null,
      status: r.status,
      error: r.error,
      event: r.last_event ?? null,
      at: r.sent_at ?? r.scheduled_for ?? null,
      sent: Boolean(r.sent_at),
      // refused then, sent by hand since — shown, but not as waiting
      superseded: Boolean(r.superseded),
    })),
  });
}
