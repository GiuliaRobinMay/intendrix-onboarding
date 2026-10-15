// GET /api/community — who is inside, client by client.
//
// The reading itself lives in lib/server/community-by-client.ts, because
// the Check who joined pass stamps members from the same answer. This
// is the door the Community tab uses.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { communityByClient } from "@/lib/server/community-by-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
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

  return NextResponse.json(await communityByClient(pool));
}
