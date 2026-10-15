// GET /api/community — who is inside, client by client.
//
// The app knows who it invited; only the community's own member list
// knows who came in. This reads that list once and sorts it against
// every client's people: which of them are inside, and who is inside on
// a client's plan without being on that client's list at all — the
// person who joined with a private address, or the account nobody
// recognises, which is exactly what a human should look at.
//
// It reads, it never writes. Stamping "joined" on a member is the job
// of the Check who joined button (community-sync), which the Community
// tab also offers.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { fetchCommunityRoster, mightyConfigured } from "@/lib/server/mighty";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CommunityPerson {
  email: string;
  name: string | null;
  plan: string | null;
  joinedAt: string | null;
}

export async function GET(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status });
  if (!dbConfigured)
    return NextResponse.json({ ok: false, reason: "no database" });

  const pool = getPool();
  if (who.userId) {
    const profile = await getProfile(pool, who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return NextResponse.json({ ok: false, reason: "Phoenix admins only" }, { status: 403 });
  } else if (authEnforced) {
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: 401 });
  }

  if (!mightyConfigured)
    return NextResponse.json({
      ok: false,
      reason: "the community is not connected — MIGHTY_API_TOKEN is not set",
    });

  const roster = await fetchCommunityRoster();
  if (!roster.ok) return NextResponse.json({ ok: false, reason: roster.reason });

  const [{ rows: clients }, { rows: members }] = await Promise.all([
    pool.query(`select id, name, short_name from clients`),
    pool.query(
      `select id, client_id, email from members
        where email is not null and email <> ''`
    ),
  ]);

  const norm = (s: string) => s.trim().toLowerCase();
  const byEmail = new Map<string, CommunityPerson>();
  for (const m of roster.members)
    if (m.email)
      byEmail.set(m.email, {
        email: m.email,
        name: m.name,
        plan: m.plan,
        joinedAt: m.joinedAt,
      });

  // every address the app knows, so a community member nobody's list
  // claims can be told apart from one who simply belongs to another client
  const claimed = new Set<string>();
  const found: Record<string, Record<string, { joinedAt: string | null }>> = {};
  for (const m of members as any[]) {
    const key = norm(String(m.email));
    const hit = byEmail.get(key);
    if (!hit) continue;
    claimed.add(key);
    (found[m.client_id] ??= {})[m.id] = { joinedAt: hit.joinedAt };
  }

  // whoever is inside on a client's plan but on nobody's list — matched
  // by the plan's name, which carries the client's name
  const extra: Record<string, CommunityPerson[]> = {};
  const unplaced: CommunityPerson[] = [];
  for (const person of byEmail.values()) {
    if (claimed.has(person.email)) continue;
    const plan = (person.plan ?? "").toLowerCase();
    const owner = plan
      ? (clients as any[]).find((c) => {
          const long = norm(c.name);
          const short = norm(c.short_name ?? "");
          return (long && plan.includes(long)) || (short.length > 2 && plan.includes(short));
        })
      : null;
    if (owner) (extra[owner.id] ??= []).push(person);
    else unplaced.push(person);
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    total: roster.members.length,
    withoutEmail: roster.members.filter((m) => !m.email).length,
    found,
    extra,
    // the long tail is the Phoenix team and admins; the list is for
    // the odd one out, so it stays short
    unplaced: unplaced.slice(0, 100),
  });
}
