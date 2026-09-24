// Who has actually walked into the community.
//
// The app stamps "invited" itself, because it sent the invitation. It
// cannot know who joined: the invitation is a shared plan link, so the
// community records no individual invite. This asks the community for
// its member roster and matches on email address.
//
// Matching is by address, lower-cased. Someone who joins with a private
// address instead of the work one we invited will not match — so the
// answer also names the community members nobody in the app claims,
// which is exactly the list worth a human minute.
//
// It lives here, not in the route, because the daily send run calls it
// too: a plan can cap how many scheduled jobs a project may have, and a
// deployment refused over a third cron entry is a worse failure than a
// check that runs an hour later than it might have.

import type { Pool } from "pg";
import { fetchCommunityRoster } from "@/lib/server/mighty";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SyncResult {
  ok: boolean;
  reason?: string;
  inCommunity?: number;
  newlyJoined?: number;
  joined?: Array<{ name: string; client: string; email: string; at: string | null }>;
  unmatched?: number;
  unmatchedPeople?: Array<{ email: string; name: string | null; plan: string | null }>;
  dryRun?: boolean;
}

/** Remember how a run went. A check nobody watches must leave a trace,
 *  or a broken integration looks exactly like a community nobody has
 *  joined — and the app keeps nagging people already inside. */
async function remember(pool: Pool, value: Record<string, unknown>) {
  await pool
    .query(
      `insert into app_settings (key, value) values ('communitySyncLast', $1)
       on conflict (key) do update set value = excluded.value`,
      [JSON.stringify({ at: new Date().toISOString(), ...value })]
    )
    .catch(() => {});
}

export async function syncCommunity(pool: Pool, dryRun: boolean): Promise<SyncResult> {
  const roster = await fetchCommunityRoster();
  if (!roster.ok) {
    if (!dryRun) await remember(pool, { ok: false, reason: roster.reason });
    return { ok: false, reason: roster.reason };
  }

  const byEmail = new Map(roster.members.map((m) => [m.email, m]));

  const { rows: members } = await pool
    .query(
      `select m.id, m.name, m.email, m.community_joined_at, c.short_name as client
         from members m
         join clients c on c.id = m.client_id
        where m.email is not null and m.email <> ''`
    )
    .catch(() => ({ rows: null as any }));
  if (!members)
    return {
      ok: false,
      reason:
        "the database is missing the onboarding columns — run the onboarding migration first",
    };

  const joined: SyncResult["joined"] = [];
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

  const unmatched = roster.members
    .filter((m) => !claimed.has(m.email))
    .map((m) => ({ email: m.email, name: m.name, plan: m.plan }));

  if (!dryRun)
    await remember(pool, {
      ok: true,
      inCommunity: roster.members.length,
      newlyJoined: joined.length,
      unmatched: unmatched.length,
    });

  return {
    ok: true,
    dryRun,
    inCommunity: roster.members.length,
    newlyJoined: joined.length,
    joined,
    unmatched: unmatched.length,
    unmatchedPeople: unmatched.slice(0, 50),
  };
}
