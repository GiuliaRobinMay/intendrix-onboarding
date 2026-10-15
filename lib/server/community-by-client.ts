// Who is inside, client by client — the one reading both the Community
// tab and the "Check who joined" pass are built on.
//
// Every client has one plan in Mighty Networks, and that plan is what
// their people come in through — so the plan's member list IS the
// client's people inside, exactly, with no guessing from addresses.
// The hosts (the Phoenix team) sit on every plan and on nobody's list;
// they are left out.
//
// Which plan is the client's: the one in their plan link when it is
// filled in, otherwise the plan whose name carries the client's name —
// returned as a guess the page can offer to save, so the link gets
// filled in from the community rather than typed.
//
// Each person inside is matched to the client's list by address, then
// by name — somebody who joined with another address than the one on
// the list still has the same name. Whoever matches nothing is shown
// as inside but not on the list.

import type { Pool } from "pg";
import {
  fetchPlanMembers,
  fetchPlans,
  mightyConfigured,
  type CommunityMember,
  type CommunityPlan,
} from "@/lib/server/mighty";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ClientCommunity {
  plan: { id: string; name: string; url: string; guessed: boolean } | null;
  reason?: string;
  /** memberId → what the plan said */
  inside: Record<string, { joinedAt: string | null; email: string }>;
  /** inside on the plan, matched to nobody on the list */
  extra: Array<{ name: string | null; email: string; joinedAt: string | null }>;
}

export type CommunityByClient =
  | { ok: true; at: string; clients: Record<string, ClientCommunity> }
  | { ok: false; reason: string };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The client's plan: named in their plan link, or guessed from its name. */
function planFor(
  client: { name: string; short_name: string | null; plan_url: string | null },
  plans: CommunityPlan[]
): { plan: CommunityPlan; guessed: boolean } | null {
  const fromLink = client.plan_url?.match(/\/plans\/(\d+)/)?.[1];
  if (fromLink) {
    const plan = plans.find((p) => p.id === fromLink) ?? {
      id: fromLink,
      name: "the plan in the link",
      url: client.plan_url!,
    };
    return { plan, guessed: false };
  }
  const name = squash(client.name);
  const short = squash(client.short_name ?? "");
  const firstWord = squash(client.name.split(/\s+/)[0] ?? "");
  // "2|42 Community Church | Intendrix Access" is the client's name and a
  // tail; the tail goes, the bar inside the name stays
  const stem = (p: CommunityPlan) => squash(p.name.replace(/\s*\|\s*[^|]*$/, ""));
  const either = (a: string, b: string) =>
    a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a));
  const candidates = plans.filter((p) => !/phoenix|template|tester/i.test(p.name));
  const hit =
    candidates.find((p) => either(stem(p), name)) ??
    candidates.find((p) => either(squash(p.name), name)) ??
    candidates.find((p) => short.length > 3 && stem(p).startsWith(short)) ??
    candidates.find((p) => firstWord.length > 4 && stem(p).startsWith(firstWord));
  return hit ? { plan: hit, guessed: true } : null;
}

export async function communityByClient(pool: Pool): Promise<CommunityByClient> {
  if (!mightyConfigured)
    return { ok: false, reason: "the community is not connected — MIGHTY_API_TOKEN is not set" };

  const plansOut = await fetchPlans();
  if (!plansOut.ok) return { ok: false, reason: plansOut.reason };
  const plans = plansOut.plans;

  const [{ rows: clients }, { rows: members }] = await Promise.all([
    pool
      .query(`select id, name, short_name, plan_url from clients`)
      .catch(() => pool.query(`select id, name, short_name, null as plan_url from clients`)),
    pool.query(`select id, client_id, name, email from members`),
  ]);

  // the Phoenix team comes in through its own plan; whoever is on it is
  // a host wherever else they appear
  const phoenixPlan = plans.find((p) => /phoenix/i.test(p.name) && /team/i.test(p.name));
  const hosts = new Set<string>();
  if (phoenixPlan) {
    const out = await fetchPlanMembers(phoenixPlan.id);
    if (out.ok) for (const m of out.members) if (m.email) hosts.add(m.email);
  }

  // one read per plan, however many clients share the view
  const resolved = (clients as any[]).map((c) => ({ client: c, found: planFor(c, plans) }));
  const planIds = [...new Set(resolved.map((r) => r.found?.plan.id).filter(Boolean))] as string[];
  const membersByPlan = new Map<string, Awaited<ReturnType<typeof fetchPlanMembers>>>();
  await Promise.all(
    planIds.map(async (id) => membersByPlan.set(id, await fetchPlanMembers(id)))
  );

  const out: Record<string, ClientCommunity> = {};

  for (const { client, found } of resolved) {
    const entry: ClientCommunity = {
      plan: found ? { ...found.plan, guessed: found.guessed } : null,
      inside: {},
      extra: [],
    };
    out[client.id] = entry;
    if (!found) {
      entry.reason = "no plan in the community carries this client's name — paste the plan link";
      continue;
    }
    const read = membersByPlan.get(found.plan.id);
    if (!read || !read.ok) {
      entry.reason = read ? read.reason : "the plan's members could not be read";
      continue;
    }

    const people: CommunityMember[] = read.members.filter(
      (m) => !m.host && !(m.email && hosts.has(m.email))
    );
    const mine = (members as any[]).filter((m) => m.client_id === client.id);
    const byEmail = new Map(
      mine.filter((m) => m.email).map((m) => [String(m.email).trim().toLowerCase(), m])
    );
    const byName = new Map(mine.map((m) => [squash(String(m.name)), m]));
    const taken = new Set<string>();

    for (const p of people) {
      const hit =
        (p.email && byEmail.get(p.email)) ||
        (p.name && byName.get(squash(p.name))) ||
        null;
      if (hit && !taken.has(hit.id)) {
        taken.add(hit.id);
        entry.inside[hit.id] = { joinedAt: p.joinedAt, email: p.email };
      } else entry.extra.push({ name: p.name, email: p.email, joinedAt: p.joinedAt });
    }
  }

  return { ok: true, at: new Date().toISOString(), clients: out };
}
