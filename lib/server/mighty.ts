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
export async function fetchCommunityRoster(): Promise<RosterResult> {
  const token = process.env.MIGHTY_API_TOKEN;
  if (!token)
    return {
      ok: false,
      reason:
        "no Mighty Networks token yet — put MIGHTY_API_TOKEN in Vercel (Mighty Networks → Admin → Settings → API Keys) and redeploy",
    };

  const members: CommunityMember[] = [];
  let cursor: string | null = null;
  // a hard stop, so a pagination field we misread cannot loop forever
  for (let page = 0; page < 40; page++) {
    const url = new URL(`${BASE}/members`);
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          // api.mn.co refuses requests without one
          "user-agent": "Intendrix/1.0 (+https://team.intendrix.ai)",
        },
        cache: "no-store",
      });
    } catch (err) {
      return { ok: false, reason: `could not reach Mighty Networks — ${String(err).slice(0, 160)}` };
    }

    const text = await res.text();
    if (!res.ok)
      return {
        ok: false,
        reason: `Mighty Networks answered ${res.status} for ${url.pathname} — ${text.slice(0, 200)}`,
      };

    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, reason: `Mighty Networks did not answer with JSON — ${text.slice(0, 160)}` };
    }

    const rows = rowsOf(body);
    if (!rows)
      return {
        ok: false,
        reason: `could not find the member list in the answer — it had ${Object.keys(
          body ?? {}
        )
          .slice(0, 8)
          .join(", ")}`,
      };

    const mapped = rows.map(toMember).filter(Boolean) as CommunityMember[];
    if (rows.length > 0 && mapped.length === 0)
      return {
        ok: false,
        reason: `the roster came back but no row carried an email address — a row had ${Object.keys(
          rows[0] ?? {}
        )
          .slice(0, 10)
          .join(", ")}`,
      };

    members.push(...mapped);
    cursor = nextPageOf(body);
    if (!cursor || rows.length === 0) break;
  }

  return { ok: true, members };
}
