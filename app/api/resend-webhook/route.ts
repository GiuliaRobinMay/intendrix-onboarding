// POST /api/resend-webhook — the provider reports what happened to each
// email after it left: delivered, opened, clicked, bounced, complained.
// Each event finds its send row by the provider's email id and updates
// the row's latest event — but only forward: a late "delivered" report
// never erases an "opened", and a bounce is never overwritten at all.
//
// Every request must carry a valid signature made with the webhook's
// signing secret (RESEND_WEBHOOK_SECRET, from the Resend dashboard).
// Without the secret configured, the endpoint refuses everything — an
// unauthenticated write path into the send log must not exist.

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** How far along an email's life each event is. Updates only move
 *  forward, so out-of-order webhook deliveries cannot regress a row. */
const RANK: Record<string, number> = {
  sent: 1,
  delivery_delayed: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  failed: 5,
  bounced: 5,
  complained: 5,
};

/** Svix-style signature check (the scheme Resend signs webhooks with):
 *  HMAC-SHA256 over "<id>.<timestamp>.<body>" with the base64 secret. */
function verifySignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string
): boolean {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();
  // header holds space-separated candidates like "v1,<base64> v1,<base64>"
  for (const candidate of signatureHeader.split(" ")) {
    const [version, sig] = candidate.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected))
      return true;
  }
  return false;
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "set RESEND_WEBHOOK_SECRET before pointing the provider here" },
      { status: 503 }
    );
  if (!dbConfigured)
    return NextResponse.json({ error: "no database" }, { status: 503 });

  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signature = req.headers.get("svix-signature") ?? "";
  const body = await req.text();

  if (!id || !timestamp || !signature)
    return NextResponse.json({ error: "unsigned" }, { status: 401 });
  // stale or future-dated requests are replays, not reports
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300)
    return NextResponse.json({ error: "timestamp out of range" }, { status: 401 });
  if (!verifySignature(secret, id, timestamp, body, signature))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // "email.opened" → "opened"; event kinds we don't track are fine to skip
  const kind = String(event?.type ?? "").replace(/^email\./, "");
  const emailId = event?.data?.email_id;
  const rank = RANK[kind];
  if (!rank || !emailId) return NextResponse.json({ received: true, ignored: true });

  const at = event?.created_at ? new Date(event.created_at) : new Date();
  const pool = getPool();
  const updated = await pool
    .query(
      `update email_sends
          set last_event = $2,
              last_event_at = $3
        where provider_id = $1
          and coalesce(case last_event
                when 'sent'             then 1
                when 'delivery_delayed' then 1
                when 'delivered'        then 2
                when 'opened'           then 3
                when 'clicked'          then 4
                when 'failed'           then 5
                when 'bounced'          then 5
                when 'complained'       then 5
              end, 0) < $4`,
      [emailId, kind, Number.isNaN(at.getTime()) ? new Date() : at, rank]
    )
    .then((r) => r.rowCount ?? 0)
    .catch(() => 0);

  return NextResponse.json({ received: true, updated });
}
