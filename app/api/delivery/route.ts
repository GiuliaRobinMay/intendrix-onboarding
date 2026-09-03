// GET /api/delivery?campaignId=…&stepId=… — who got one lesson email and
// what the provider reported for each: delivered, opened, clicked,
// bounced. The per-person view behind the counts in the mailbox.

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

  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  const stepId = url.searchParams.get("stepId");
  if (!campaignId || !stepId)
    return NextResponse.json({ error: "campaign and lesson required" }, { status: 400 });

  const q = (withEvents: boolean) =>
    pool.query(
      `select coalesce(m.name, e.shadow_to) as name,
              coalesce(e.shadow_to, m.email) as email,
              (e.shadow_to is not null) as is_copy,
              e.status, e.error, e.sent_at
              ${withEvents ? ", e.last_event, e.last_event_at" : ""}
         from email_sends e
         left join members m on m.id = e.member_id
        where e.campaign_id = $1 and e.step_id = $2
        order by (e.shadow_to is not null), coalesce(m.name, e.shadow_to)`,
      [campaignId, stepId]
    );

  // a database from before the delivery-status columns still answers
  const { rows } = await q(true).catch(() => q(false));

  return NextResponse.json({
    rows: rows.map((r: any) => ({
      name: r.name,
      email: r.email,
      copy: r.is_copy,
      status: r.status,
      error: r.error,
      event: r.last_event ?? null,
      at: r.last_event_at ?? r.sent_at ?? null,
    })),
  });
}
