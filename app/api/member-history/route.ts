// GET /api/member-history?memberId=… — every email one person was sent,
// newest first, with what the provider reported about each: the
// individual-level answer to "did they get it?".

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ error: "sign in first" }, { status: who.status });
  if (!dbConfigured) return NextResponse.json({ rows: [] });

  const pool = getPool();
  if (who.userId) {
    const profile = await getProfile(pool, who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return NextResponse.json({ error: "Phoenix admins only" }, { status: 403 });
  } else if (authEnforced) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }

  const memberId = new URL(req.url).searchParams.get("memberId");
  if (!memberId)
    return NextResponse.json({ error: "member required" }, { status: 400 });

  const q = (withEvents: boolean) =>
    pool.query(
      `select e.status, e.error, e.sent_at, e.scheduled_for,
              ss.title as step_title, ss.code as step_code,
              c.code as campaign_code
              ${withEvents ? ", e.last_event, e.last_event_at" : ""}
         from email_sends e
         join campaigns c on c.id = e.campaign_id
         left join series_steps ss on ss.id = e.step_id
        where e.member_id = $1
        order by coalesce(e.sent_at, e.scheduled_for) desc`,
      [memberId]
    );

  // a database from before the delivery-status columns still answers
  const { rows } = await q(true).catch(() => q(false));

  return NextResponse.json({
    rows: rows.map((r: any) => ({
      title: r.step_title ?? r.step_code ?? "lesson",
      campaign: r.campaign_code,
      status: r.status,
      error: r.error,
      event: r.last_event ?? null,
      at: r.sent_at ?? r.scheduled_for ?? null,
    })),
  });
}
