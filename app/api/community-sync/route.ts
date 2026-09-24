// POST /api/community-sync — who has actually walked into the community.
//
// The work itself lives in lib/server/community-sync.ts, because the
// daily send run does the same pass. This is the door a person uses:
// the Check who joined button on a campaign.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { getProfile, verifyUser } from "@/lib/server/auth";
import { syncCommunity } from "@/lib/server/community-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!dbConfigured)
    return NextResponse.json({ ok: false, reason: "no database" }, { status: 503 });

  // the daily run carries the cron secret; a person carries their sign-in
  const secret = process.env.CRON_SECRET;
  const fromCron =
    Boolean(secret) && (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;

  const pool = getPool();
  if (!fromCron) {
    const who = await verifyUser(req);
    if (!who.ok)
      return NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status });
    if (who.userId) {
      const profile = await getProfile(pool, who.userId).catch(() => null);
      if (profile?.role !== "phoenix_admin")
        return NextResponse.json({ ok: false, reason: "Phoenix admins only" }, { status: 403 });
    }
  }

  const dryRun =
    new URL(req.url).searchParams.get("dryrun") === "1" ||
    (await req
      .json()
      .then((b) => b?.dryrun === true)
      .catch(() => false));

  return NextResponse.json(await syncCommunity(pool, dryRun));
}
