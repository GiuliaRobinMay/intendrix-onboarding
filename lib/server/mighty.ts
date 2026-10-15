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

// Which path holds the roster, read off the published spec at
// api.mn.co/admin/v1/spec.json rather than guessed at.
//
// It is GET /admin/v1/networks/{network_id}/members. Two earlier
// attempts both missed: the flat /members, which addresses no network
// and 404s, and then a discovery call to /networks to find the id,
// which is not an endpoint — the spec has no "list my networks".
//
// It does not need one. network_id accepts the subdomain as well as the
// number, and the subdomain is in the address bar of the community.
const NETWORK = process.env.MIGHTY_NETWORK_ID?.trim() || "transformational-leaders";

/** The endpoint's documented maximum. */
const PER_PAGE = 100;

/** Where the community lives for people — plan and space links point here. */
const SITE = (process.env.MIGHTY_SITE_URL || "https://intendrix.ai").replace(/\/+$/, "");

const MEMBERS_PATH =
  process.env.MIGHTY_MEMBERS_PATH?.trim() || `/networks/${NETWORK}/members`;

export const mightyConfigured = Boolean(process.env.MIGHTY_API_TOKEN);

export interface CommunityMember {
  email: string;
  name: string | null;
  /** when they joined, ISO — null when the roster does not say */
  joinedAt: string | null;
  /** the plan that let them in; this is what names the client */
  plan: string | null;
  /** a Host — the Phoenix team and admins, never a client's person */
  host: boolean;
}

export interface CommunityPlan {
  id: string;
  name: string;
  /** the admin page of the plan, when the API says; built from the id otherwise */
  url: string;
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
  // The roster masks addresses as a***@***.*** for a token whose plan
  // does not include member-email visibility. That is not an address,
  // it just looks like one — treating it as real would match nobody and
  // report it as nobody having joined.
  const real = email && !email.includes("***") ? email.toLowerCase() : "";
  return {
    email: real,
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
    host: isHost(row),
  };
}

/** Hosts run the network; they are on every client's plan and on
 *  nobody's client list, so a per-client view leaves them out. */
function isHost(row: any): boolean {
  for (const k of ["network_role", "networkRole", "role", "member_type", "memberType", "membership.role"]) {
    const v = k.split(".").reduce((o: any, part) => o?.[part], row);
    if (typeof v === "string" && /host|moderator|admin/i.test(v)) return true;
  }
  for (const k of ["is_host", "isHost", "host", "is_admin", "isAdmin"])
    if (row?.[k] === true) return true;
  return false;
}

/** One plan row, whatever Mighty calls its columns. */
function toPlan(row: any): CommunityPlan | null {
  const id = row?.id ?? row?.resource_id ?? row?.resourceId ?? row?.plan_id;
  const name = firstString(row, ["name", "title", "plan_name"]);
  if (id === undefined || id === null || !name) return null;
  return {
    id: String(id),
    name,
    url:
      firstString(row, ["url", "admin_url", "adminUrl"]) ??
      `${SITE}/settings/payments/plans/${id}`,
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
  const out = await readPages(path, token, toMember, (m) => Boolean(m.email || m.name));
  return out.ok ? { ok: true, members: out.rows } : out;
}

/** Every page of one list, mapped; or why the list could not be read.
 *  `sane` says whether a mapped row looks like the kind expected, so a
 *  page of the wrong shape is reported rather than counted as empty. */
async function readPages<T>(
  path: string,
  token: string,
  map: (row: any) => T | null,
  sane: (row: T) => boolean
): Promise<{ ok: true; rows: T[] } | { ok: false; reason: string }> {
  const all: T[] = [];

  // page and per_page, and nothing else. This endpoint rejects any
  // parameter it does not know with a 400, so the hopeful extras this
  // used to send alongside them — limit, cursor — failed every request
  // outright rather than being ignored. Paging is by page number; there
  // is no cursor.
  for (let page = 1; page <= 40; page++) {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));

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

    const mapped = rows.map(map).filter((r): r is T => r !== null);
    // a page where not one row reads as expected is not this list at
    // all — it is the wrong shape, and saying so beats reporting a
    // community with nobody in it
    if (rows.length > 0 && !mapped.some(sane))
      return {
        ok: false,
        reason: `rows were not the expected shape — one row held ${Object.keys(rows[0] ?? {})
          .slice(0, 10)
          .join(", ")}`,
      };

    all.push(...mapped);
    // a short page is the last one
    if (rows.length < PER_PAGE) break;
  }

  return { ok: true, rows: all };
}

const tokenOr = () =>
  process.env.MIGHTY_API_TOKEN ||
  null;

/** Every plan in the network — each client has one, and its name
 *  carries the client's name. */
export async function fetchPlans(): Promise<
  { ok: true; plans: CommunityPlan[] } | { ok: false; reason: string }
> {
  const token = tokenOr();
  if (!token) return { ok: false, reason: "no Mighty Networks token yet" };
  const out = await readPages(`/networks/${NETWORK}/plans`, token, toPlan, (p) => Boolean(p.name));
  return out.ok
    ? { ok: true, plans: out.rows }
    : { ok: false, reason: `could not read the plans — ${out.reason}` };
}

/** Everyone who came in through one plan: a client's people, exactly,
 *  plus the hosts who are on every plan. */
export async function fetchPlanMembers(planId: string): Promise<RosterResult> {
  const token = tokenOr();
  if (!token) return { ok: false, reason: "no Mighty Networks token yet" };
  const out = await readAll(`/networks/${NETWORK}/plans/${encodeURIComponent(planId)}/members`, token);
  return out.ok
    ? out
    : { ok: false, reason: `could not read the plan's members — ${out.reason}` };
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

  const out = await readAll(
    MEMBERS_PATH.startsWith("/") ? MEMBERS_PATH : `/${MEMBERS_PATH}`,
    token
  );
  if (out.ok) return { ok: true, members: out.members };

  // One address, one reason. The old version tried five spellings and
  // reported all five, which read as five different faults.
  return {
    ok: false,
    reason:
      `could not read the roster at ${MEMBERS_PATH} — ${out.reason}. ` +
      `If the community is not "${NETWORK}", set MIGHTY_NETWORK_ID in Vercel to its subdomain or numeric id.`,
  };
}
