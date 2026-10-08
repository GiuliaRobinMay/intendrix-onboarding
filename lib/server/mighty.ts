// Mighty Networks — reading who is actually in the community.
//
// The app knows who it invited, because it sent the invitation. It has
// no way of knowing who walked through the door: the invitation is a
// shared plan link, so nobody is tracked individually, and Mighty's own
// invite list is empty for these clients. The only source of truth for
// "joined" is the community's member roster.
//
// One long-lived admin token reads it: Mighty Networks → Admin →
// Settings → API Keys. Set it as MIGHTY_API_TOKEN in Vercel.
//
// The exact shape of a member row is not pinned down here on purpose.
// Mighty's roster has grown field by field, so this reads defensively:
// it looks for an email under any of the names it has been known by,
// and when it finds nothing it says what it did receive rather than
// quietly reporting an empty community — which would look exactly like
// "nobody has joined".

const BASE = (process.env.MIGHTY_API_BASE || "https://api.mn.co/admin/v1").replace(
  /\/+$/,
  ""
);

// Which path holds the roster.
//
// The documented one hangs off the network: /networks/{id}/members. The
// flat spellings below are what this file tried first and they answer
// 404 — a token with no network in the path addresses no roster at all,
// which is why the check reported an unreadable community rather than
// an empty one.
//
// The network id comes from MIGHTY_NETWORK_ID when it is set, and is
// otherwise asked for once per run. The flat paths stay as fallbacks:
// they cost one request each and they are the only safety net if Mighty
// moves this corner again.
const FLAT_PATHS = ["/members", "/network/members", "/memberships", "/people"];

const pinnedPath = process.env.MIGHTY_MEMBERS_PATH
  ? [
      process.env.MIGHTY_MEMBERS_PATH.startsWith("/")
        ? process.env.MIGHTY_MEMBERS_PATH
        : `/${process.env.MIGHTY_MEMBERS_PATH}`,
    ]
  : null;

export const mightyConfigured = Boolean(process.env.MIGHTY_API_TOKEN);

export interface CommunityMember {
  email: string;
  name: string | null;
  /** when they joined, ISO — null when the roster does not say */
  joinedAt: string | null;
  /** the plan that let them in; this is what names the client */
  plan: string | null;
}

export type RosterResult =
  | { ok: true; members: CommunityMember[] }
  | { ok: false; reason: string };

/* eslint-disable @typescript-eslint/no-explicit-any */

const firstString = (row: any, keys: string[]): string | null => {
  for (const k of keys) {
    const v = k.split(".").reduce((o: any, part) => o?.[part], row);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/** One roster row, whatever Mighty happens to call its columns.
 *
 *  A row with no address is kept, with an empty one. Mighty leaves the
 *  field blank for anyone who has not consented to share it, and blanks
 *  it wholesale for a token that is not a Network Host — so the count of
 *  these is the difference between "nobody matched" and "we were not
 *  allowed to see who anybody is", and dropping them here would hide
 *  exactly that. */
function toMember(row: any): CommunityMember | null {
  const email = firstString(row, [
    "email",
    "email_address",
    "emailAddress",
    "user.email",
    "member.email",
  ]);
  return {
    email: email ? email.toLowerCase() : "",
    name:
      firstString(row, ["name", "full_name", "fullName", "display_name"]) ??
      ([firstString(row, ["first_name", "firstName"]), firstString(row, ["last_name", "lastName"])]
        .filter(Boolean)
        .join(" ") ||
        null),
    joinedAt:
      firstString(row, [
        "joined_at",
        "joinedAt",
        "created_at",
        "createdAt",
        "membership.created_at",
      ]) ?? null,
    plan: planOf(row),
  };
}

/** The plan that let someone in — this is what names their client.
 *  Mighty hands it over as a single object on some shapes and as a list
 *  on others (somebody on two plans has two), so both are read, and a
 *  list comes back joined rather than silently reduced to its first. */
function planOf(row: any): string | null {
  const one = firstString(row, [
    "plan.name",
    "plan_name",
    "planName",
    "membership.plan.name",
  ]);
  if (one) return one;
  for (const path of [
    "plans",
    "payment_plans",
    "paymentPlans",
    "membership.plans",
    "membership.accessPathPlans.nodes",
    "membership.access_path_plans",
  ]) {
    const v = path.split(".").reduce((o: any, part) => o?.[part], row);
    const list = Array.isArray(v) ? v : Array.isArray(v?.nodes) ? v.nodes : null;
    if (!list?.length) continue;
    const names = list
      .map((x: any) => (typeof x === "string" ? x : firstString(x, ["name", "title"])))
      .filter(Boolean);
    if (names.length) return names.join(" · ");
  }
  return null;
}

/** The list of rows inside whatever envelope the API answers with. */
function rowsOf(body: any): any[] | null {
  if (Array.isArray(body)) return body;
  for (const key of ["data", "members", "results", "items", "records"]) {
    const v = body?.[key];
    if (Array.isArray(v)) return v;
    if (Array.isArray(v?.members)) return v.members;
  }
  return null;
}

/** The cursor or page pointer for the next slice, if there is one. */
function nextPageOf(body: any): string | null {
  const meta = body?.meta ?? body?.pagination ?? body;
  const next =
    meta?.next_cursor ?? meta?.nextCursor ?? meta?.next_page ?? meta?.nextPage ?? null;
  return typeof next === "string" || typeof next === "number" ? String(next) : null;
}

/**
 * Everyone in the community, with their email address.
 *
 * Never throws: a failure comes back as a reason in English, because
 * the caller has to be able to tell "the community is empty" apart
 * from "we could not read the community".
 */
/** One request, with everything api.mn.co insists on. */
async function get(url: string, token: string) {
  return fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      // api.mn.co refuses a request without one
      "user-agent": "Intendrix/1.0 (+https://team.intendrix.ai)",
    },
    cache: "no-store",
  });
}

/** Read one path to the end, or say why it is not the one. */
async function readAll(
  path: string,
  token: string
): Promise<{ ok: true; members: CommunityMember[] } | { ok: false; reason: string }> {
  const members: CommunityMember[] = [];
  let cursor: string | null = null;
  let page = 1;

  // a hard stop, so a pagination field read wrongly cannot loop forever
  for (let round = 0; round < 40; round++) {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    else if (page > 1) url.searchParams.set("page", String(page));

    let res: Response;
    try {
      res = await get(url.toString(), token);
    } catch (err) {
      return { ok: false, reason: `could not be reached — ${String(err).slice(0, 120)}` };
    }

    const text = await res.text();
    if (!res.ok) return { ok: false, reason: `answered ${res.status} — ${text.slice(0, 140)}` };

    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, reason: `did not answer with JSON — ${text.slice(0, 120)}` };
    }

    const rows = rowsOf(body);
    if (!rows)
      return {
        ok: false,
        reason: `no list in the answer — it held ${Object.keys(body ?? {}).slice(0, 8).join(", ") || "nothing"}`,
      };

    const mapped = rows.map(toMember).filter(Boolean) as CommunityMember[];
    // a page where not one row carries a name or an address is not a
    // roster at all — it is the wrong shape, and saying so beats
    // reporting a community with nobody in it
    if (rows.length > 0 && !mapped.some((m) => m.email || m.name))
      return {
        ok: false,
        reason: `rows carried neither name nor email — one row held ${Object.keys(rows[0] ?? {})
          .slice(0, 10)
          .join(", ")}`,
      };

    members.push(...mapped);
    cursor = nextPageOf(body);
    page += 1;
    // no cursor and a short page means the end; a full page with no
    // cursor means page numbers, so keep going
    if (!cursor && rows.length < 100) break;
    if (rows.length === 0) break;
  }

  return { ok: true, members };
}

/**
 * Everyone in the community, with their email address.
 *
 * Never throws: a failure comes back as a reason in English, because
 * the caller has to be able to tell "the community is empty" apart
 * from "we could not read the community". The reason names every path
 * tried and what each one said, so one failed run is enough to know
 * exactly which spelling this network uses.
 */
export async function fetchCommunityRoster(): Promise<RosterResult> {
  const token = process.env.MIGHTY_API_TOKEN;
  if (!token)
    return {
      ok: false,
      reason:
        "no Mighty Networks token yet — put MIGHTY_API_TOKEN in Vercel (Mighty Networks → Admin → Settings → API Keys) and redeploy",
    };

  const tried: string[] = [];
  const paths = pinnedPath ?? [];
  if (!pinnedPath) {
    const network = await findNetworkId(token);
    if (network.id) paths.push(`/networks/${network.id}/members`);
    else tried.push(`/networks: ${network.reason}`);
    paths.push(...FLAT_PATHS);
  }

  for (const path of paths) {
    const out = await readAll(path, token);
    if (out.ok && out.members.length > 0) return { ok: true, members: out.members };
    // an empty list from a path that answered cleanly is still an
    // answer — keep it in case every other path fails outright
    if (out.ok) {
      tried.push(`${path}: answered, but with nobody in it`);
      continue;
    }
    tried.push(`${path}: ${out.reason}`);
  }

  return {
    ok: false,
    reason: `could not read the roster. ${tried.join(" · ")}`,
  };
}

/**
 * Which network this token belongs to.
 *
 * The roster lives under /networks/{id}/members, so without an id there
 * is no roster to read — and every flat spelling this file used to try
 * answers 404, which reads as "the community could not be reached"
 * rather than "we asked the wrong question".
 *
 * MIGHTY_NETWORK_ID settles it outright. Otherwise the token is asked
 * what it can see, and the single network it names is used.
 */
async function findNetworkId(
  token: string
): Promise<{ id: string | null; reason: string }> {
  const pinned = process.env.MIGHTY_NETWORK_ID?.trim();
  if (pinned) return { id: pinned, reason: "set by hand" };

  let res: Response;
  try {
    res = await get(`${BASE}/networks`, token);
  } catch (err) {
    return { id: null, reason: `could not be reached — ${String(err).slice(0, 100)}` };
  }
  const text = await res.text();
  if (!res.ok) return { id: null, reason: `answered ${res.status} — ${text.slice(0, 120)}` };

  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return { id: null, reason: `did not answer with JSON — ${text.slice(0, 100)}` };
  }
  const rows = rowsOf(body) ?? (body?.id ? [body] : null);
  const id = rows?.length
    ? firstString(rows[0], ["id", "network_id", "networkId", "resource_id", "resourceId"]) ??
      (typeof rows[0]?.id === "number" ? String(rows[0].id) : null)
    : null;
  if (!id)
    return {
      id: null,
      reason: `named no network — the answer held ${
        Object.keys(body ?? {}).slice(0, 8).join(", ") || "nothing"
      }`,
    };
  return { id, reason: "found" };
}
