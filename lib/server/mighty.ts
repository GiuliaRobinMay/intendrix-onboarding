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

// Which path holds the roster. Mighty's admin API has renamed this
// corner more than once, so rather than betting on one spelling the
// reader tries each in turn and keeps the first that answers with a
// list. MIGHTY_MEMBERS_PATH pins it once we know.
const CANDIDATE_PATHS = (
  process.env.MIGHTY_MEMBERS_PATH
    ? [process.env.MIGHTY_MEMBERS_PATH]
    : ["/members", "/network/members", "/memberships", "/people"]
).map((p) => (p.startsWith("/") ? p : `/${p}`));

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

/** One roster row, whatever Mighty happens to call its columns. */
function toMember(row: any): CommunityMember | null {
  const email = firstString(row, [
    "email",
    "email_address",
    "emailAddress",
    "user.email",
    "member.email",
  ]);
  if (!email) return null;
  return {
    email: email.toLowerCase(),
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
    plan: firstString(row, [
      "plan.name",
      "plan_name",
      "planName",
      "membership.plan.name",
    ]),
  };
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
    if (rows.length > 0 && mapped.length === 0)
      return {
        ok: false,
        reason: `rows carried no email address — one row held ${Object.keys(rows[0] ?? {})
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
  for (const path of CANDIDATE_PATHS) {
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
