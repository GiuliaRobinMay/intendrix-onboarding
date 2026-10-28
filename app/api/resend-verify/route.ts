// /api/resend-verify — the sending domain at Resend, from the app.
//
// Resend checks a new DNS record for 72 hours and then stops; a record
// added later shows Failed until somebody asks for another look, and the
// dashboard offers no button for that. The API does: POST /domains/{id}
// /verify. The same API switches open and click tracking on, which is
// what makes opens and clicks exist at all.
//
// POST { action: "status" | "verify" | "tracking" } — status reads the
// domain and its records; verify asks for a new check, then reads;
// tracking turns open and click tracking on, then reads.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { FALLBACK_SENDING_ADDRESS } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

const API = "https://api.resend.com";
const DOMAIN =
  process.env.RESEND_DOMAIN?.trim() || FALLBACK_SENDING_ADDRESS.split("@")[1];

async function resend(method: string, path: string, body?: unknown) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false as const, reason: "RESEND_API_KEY is not set" };
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false as const, reason: `Resend could not be reached — ${String(err).slice(0, 120)}` };
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* empty */
  }
  if (!res.ok)
    return { ok: false as const, reason: `Resend answered ${res.status} — ${json?.message ?? text.slice(0, 160)}` };
  return { ok: true as const, body: json };
}

/** The domain record Resend holds for our sending domain. */
async function findDomain() {
  const list = await resend("GET", "/domains");
  if (!list.ok) return list;
  const rows: any[] = list.body?.data ?? [];
  const hit = rows.find((d) => String(d?.name).toLowerCase() === DOMAIN.toLowerCase());
  if (!hit)
    return {
      ok: false as const,
      reason: `Resend has no domain named ${DOMAIN} — it has ${rows.map((d) => d?.name).join(", ") || "none"}`,
    };
  return { ok: true as const, id: String(hit.id) };
}

function shape(d: any) {
  return {
    name: d?.name ?? DOMAIN,
    status: d?.status ?? "unknown",
    openTracking: Boolean(d?.open_tracking),
    clickTracking: Boolean(d?.click_tracking),
    records: (Array.isArray(d?.records) ? d.records : []).map((r: any) => ({
      record: r?.record ?? "",
      type: r?.type ?? "",
      name: r?.name ?? "",
      value: String(r?.value ?? "").slice(0, 60),
      status: r?.status ?? "unknown",
    })),
  };
}

export async function POST(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status });
  if (who.userId && dbConfigured) {
    const profile = await getProfile(getPool(), who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return NextResponse.json({ ok: false, reason: "Phoenix admins only" }, { status: 403 });
  } else if (authEnforced) {
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: 401 });
  }

  let action = "status";
  try {
    action = String((await req.json())?.action ?? "status");
  } catch {
    /* status */
  }

  const found = await findDomain();
  if (!found.ok) return NextResponse.json({ ok: false, reason: found.reason });

  const notes: string[] = [];
  if (action === "verify") {
    const v = await resend("POST", `/domains/${found.id}/verify`);
    notes.push(v.ok ? "Asked Resend to check the records again." : v.reason);
  } else if (action === "tracking") {
    const t = await resend("PATCH", `/domains/${found.id}`, {
      open_tracking: true,
      click_tracking: true,
    });
    notes.push(t.ok ? "Open and click tracking switched on." : t.reason);
  }

  const d = await resend("GET", `/domains/${found.id}`);
  if (!d.ok) return NextResponse.json({ ok: false, reason: d.reason, notes });
  return NextResponse.json({ ok: true, notes, domain: shape(d.body) });
}
