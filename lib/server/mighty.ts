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

export interface CommunitySpace {
  id: string;
  name: string;
  url: string;
  /** the sidebar group it sits in — TEAM CONNECT holds the client spaces */
  collection: string | null;
  collectionId: string | null;
}

export interface Coursework {
  id: string;
  /** overview, section, lesson or quiz */
  type: string;
  parentId: string | null;
  title: string;
  /** the body, as Mighty hands it over — HTML, usually */
  description: string | null;
  status: string | null;
  position: number;
  url: string | null;
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

/** One space row, whatever Mighty calls its columns. */
function toSpace(row: any): CommunitySpace | null {
  const id = row?.id ?? row?.resource_id ?? row?.resourceId ?? row?.space_id;
  const name = firstString(row, ["name", "title"]);
  if (id === undefined || id === null || !name) return null;
  const col =
    row?.collection_id ??
    row?.collection?.id ??
    row?.spaces_collection_id ??
    row?.spaces_collection?.id ??
    row?.spacesCollection?.id ??
    null;
  return {
    id: String(id),
    name,
    url: firstString(row, ["url", "web_url", "webUrl", "link"]) ?? `${SITE}/spaces/${id}`,
    collection: firstString(row, [
      "collection.name",
      "spaces_collection.name",
      "spacesCollection.name",
      "collection_name",
    ]),
    collectionId: col === null || col === undefined ? null : String(col),
  };
}

/** One coursework row — a module or a lesson — whatever Mighty calls its columns. */
function toCoursework(row: any): Coursework | null {
  const id = row?.id ?? row?.resource_id ?? row?.resourceId;
  const title = firstString(row, ["title", "name"]);
  if (id === undefined || id === null || !title) return null;
  const parent = row?.parent_id ?? row?.parentId ?? row?.parent?.id ?? null;
  return {
    id: String(id),
    type: (firstString(row, ["type", "coursework_type"]) ?? "lesson").toLowerCase(),
    parentId: parent === null || parent === undefined ? null : String(parent),
    title,
    description: firstString(row, ["description", "body", "description_text", "descriptionText"]),
    status: firstString(row, ["status"])?.toLowerCase() ?? null,
    position: Number(row?.position ?? 0) || 0,
    url: firstString(row, ["permalink", "url", "web_url"]),
  };
}

/** Every module and lesson of one lesson space, in order. */
export async function fetchCourseworks(spaceId: string): Promise<
  { ok: true; items: Coursework[] } | { ok: false; reason: string }
> {
  const token = tokenOr();
  if (!token) return { ok: false, reason: "no Mighty Networks token yet" };
  const out = await readPages(
    `/networks/${NETWORK}/spaces/${encodeURIComponent(spaceId)}/courseworks`,
    token,
    toCoursework,
    (c) => Boolean(c.title)
  );
  return out.ok
    ? { ok: true, items: out.rows.sort((a, b) => a.position - b.position) }
    : { ok: false, reason: `could not read the lessons — ${out.reason}` };
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
      // the API answers in the language of the key's account; ask for
      // English so an error reads the same to everyone on the team
      "accept-language": "en",
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

/** Every space in the network, with the group it sits in. */
export async function fetchSpaces(): Promise<
  { ok: true; spaces: CommunitySpace[] } | { ok: false; reason: string }
> {
  const token = tokenOr();
  if (!token) return { ok: false, reason: "no Mighty Networks token yet" };
  const out = await readPages(`/networks/${NETWORK}/spaces`, token, toSpace, (sp) => Boolean(sp.name));
  return out.ok
    ? { ok: true, spaces: out.rows }
    : { ok: false, reason: `could not read the spaces — ${out.reason}` };
}

/** One request that changes something, with everything api.mn.co insists on. */
async function send(method: "POST" | "DELETE" | "PATCH", path: string, body?: unknown) {
  const token = tokenOr();
  if (!token) return { ok: false as const, reason: "no Mighty Networks token yet" };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "accept-language": "en",
        "content-type": "application/json",
        "user-agent": "Intendrix/1.0 (+https://team.intendrix.ai)",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false as const, reason: `could not be reached — ${String(err).slice(0, 120)}` };
  }
  const text = await res.text();
  if (!res.ok) return { ok: false as const, reason: `answered ${res.status} — ${text.slice(0, 200)}` };
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* an empty or non-JSON success is still a success */
  }
  return { ok: true as const, body: json };
}

export interface CreatedPost {
  id: string;
  url: string | null;
  /** image addresses Mighty reports on the post — the test of whether an
   *  image in the body survived */
  images: string[];
  raw: any;
}

/** Write an article into a space. An "article" lands in the space's
 *  articles tab — Phoenix Updates, in a client space. */
export async function createPost(input: {
  spaceId: string;
  title: string;
  description: string;
  postType?: string;
}): Promise<{ ok: true; post: CreatedPost } | { ok: false; reason: string }> {
  const out = await send("POST", `/networks/${NETWORK}/posts`, {
    space_id: Number(input.spaceId),
    title: input.title,
    description: input.description,
    post_type: input.postType ?? "article",
  });
  if (!out.ok) return { ok: false, reason: `could not create the post — ${out.reason}` };
  const row = out.body?.data ?? out.body ?? {};
  const id = row?.id ?? row?.resource_id;
  if (id === undefined || id === null)
    return { ok: false, reason: `the post was made but the answer named no id — it held ${Object.keys(row).slice(0, 8).join(", ")}` };
  return {
    ok: true,
    post: {
      id: String(id),
      url: firstString(row, ["permalink", "url"]),
      images: Array.isArray(row?.images) ? row.images.map(String) : [],
      raw: row,
    },
  };
}

/** Take a post down. */
export async function deletePost(postId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const out = await send("DELETE", `/networks/${NETWORK}/posts/${encodeURIComponent(postId)}/`);
  return out.ok ? { ok: true } : { ok: false, reason: `could not delete the post — ${out.reason}` };
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
