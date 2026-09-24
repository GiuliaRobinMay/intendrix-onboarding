// POST /api/community-sync — who has actually walked into the community.
//
// The app stamps "invited" itself, because it sent the invitation. It
// cannot know who joined: the invitation is a shared plan link, so the
// community records no individual invite. This asks the community for
// its member roster and matches on email address.
//
// Matching is by address, lower-cased. Someone who joins with a private
// address instead of the work one we invited will not match — so the
// answer also names the community members nobody in the app claims,
// which is exactly the list of people to look at by hand.
//
// GET with ?dryrun=1 changes nothing and reports what it would do.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { getProfile, verifyUser } from "@/lib/server/auth";
import { fetchCommunityRoster } from "@/lib/server/mighty";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

async function run(dryRun: boolean) {
  if (!dbConfigured)
    return NextResponse.json({ ok: false, reason: "no database" }, { status: 503 });

  const pool0 = getPool();
  const remember = async (value: Record<string, unknown>) => {
    // a nightly run nobody watches must leave a trace, or a broken
    // integration looks exactly like a community nobody has joined
    await pool0
      .query(
        `insert into app_settings (key, value) values ('communitySyncLast', $1)
         on conflict (key) do update set value = excluded.value`,
        [JSON.stringify({ at: new Date().toISOString(), ...value })]
      )
      .catch(() => {});
  };

  const roster = await fetchCommunityRoster();
  if (!roster.ok) {
    if (!dryRun) await remember({ ok: false, reason: roster.reason });
    return NextResponse.json({ ok: false, reason: roster.reason });
  }

  const byEmail = new Map(roster.members.map((m) => [m.email, m]));

  const pool = getPool();
  const { rows: members } = await pool
    .query(
      `select m.id, m.name, m.email, m.community_joined_at, c.short_name as client
         from members m
         join clients c on c.id = m.client_id
        where m.email is not null and m.email <> ''`
    )
    .catch(() => ({ rows: null as any }));
  if (!members)
    return NextResponse.json({
      ok: false,
      reason:
        "the database is missing the onboarding columns — run the onboarding migration first",
    });

  const joined: Array<{ name: string; client: string; email: string; at: string | null }> = [];
  const claimed = new Set<string>();

  for (const m of members as any[]) {
    const hit = byEmail.get(String(m.email).trim().toLowerCase());
    if (!hit) continue;
    claimed.add(hit.email);
    if (m.community_joined_at) continue;      // already known, nothing to do
    joined.push({ name: m.name, client: m.client, email: hit.email, at: hit.joinedAt });
    if (!dryRun)
      await pool.query(
        `update members
            set community_joined_at = coalesce(community_joined_at, $2::timestamptz, now())
          where id = $1`,
        [m.id, hit.joinedAt]
      );
  }

  // in the community, but no member of ours carries that address: a
  // private address, a typo, or somebody we never invited
  const unmatched = roster.members
    .filter((m) => !claimed.has(m.email))
    .map((m) => ({ email: m.email, name: m.name, plan: m.plan }));

  if (!dryRun)
    await remember({
      ok: true,
      inCommunity: roster.members.length,
      newlyJoined: joined.length,
      unmatched: unmatched.length,
    });

  return NextResponse.json({
    ok: true,
    dryRun,
    inCommunity: roster.members.length,
    newlyJoined: joined.length,
    joined,
    unmatched: unmatched.length,
    unmatchedPeople: unmatched.slice(0, 50),
  });
}

export async function POST(req: Request) {
  // the daily run carries the cron secret; a person carries their sign-in
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const fromCron = Boolean(secret) && header === `Bearer ${secret}`;

  if (!fromCron) {
    const who = await verifyUser(req);
    if (!who.ok)
      return NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status });
    if (who.userId) {
      const pool = getPool();
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

  return run(dryRun);
}

/** The daily pass Vercel Cron calls — it may only read. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { ok: false, reason: "set CRON_SECRET before running this on a schedule" },
      { status: 503 }
    );
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`)
    return NextResponse.json({ ok: false, reason: "not authorised" }, { status: 401 });
  return run(false);
}
