// POST /api/send-agreement — send the user agreement to a campaign's
// members who have not accepted it yet. Each gets a personal accept
// link; the click on that page is what gets recorded as proof. With
// remind: true the send goes to people who already received it but have
// not accepted, instead of to fresh recipients. ?dryrun=1 only counts.

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { emailConfigured, renderAgreementEmail } from "@/lib/server/email";
import {
  campaignContext,
  firstNameOf,
  publicBaseUrl,
  sendPaced,
} from "@/lib/server/onboarding";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 });
  }
  const { campaignId } = body ?? {};
  if (!campaignId)
    return NextResponse.json({ ok: false, reason: "campaign required" }, { status: 400 });
  const remind = body?.remind === true;
  const dryRun =
    new URL(req.url).searchParams.get("dryrun") === "1" || body?.dryrun === true;

  const ctx = await campaignContext(pool, campaignId);
  if ("error" in ctx) return NextResponse.json({ ok: false, reason: ctx.error });
  const { campaign, from, logoUrl } = ctx;

  // only the people put on THIS campaign's client team. A client runs
  // several programs with different people in each, so onboarding must
  // follow the campaign, never the whole company address book.
  const { rows: members } = await pool
    .query(
      `select m.* from members m
         join campaign_client_assignments a on a.member_id = m.id
        where a.campaign_id = $1
          and coalesce(m.status, 'active') = 'active'
        group by m.id
        order by m.name`,
      [campaignId]
    )
    .catch(() => ({ rows: null }));
  if (!members)
    return NextResponse.json({
      ok: false,
      reason:
        "the database is missing the onboarding update — paste the latest migration into the Supabase SQL editor first",
    });
  if (members.length === 0)
    return NextResponse.json({
      ok: false,
      reason:
        "nobody is on this campaign's client team yet — add the people taking part, then send",
    });

  const signed = members.filter((m: any) => m.agreement_signed_at);
  const pending = members.filter(
    (m: any) => !m.agreement_signed_at && m.agreement_sent_at
  );
  const fresh = members.filter(
    (m: any) => !m.agreement_signed_at && !m.agreement_sent_at
  );
  const targets = (remind ? pending : fresh).filter((m: any) => m.email);
  const noEmail = (remind ? pending : fresh).filter((m: any) => !m.email).length;

  if (dryRun || !emailConfigured)
    return NextResponse.json({
      ok: true,
      dryRun: true,
      toSend: targets.length,
      signed: signed.length,
      pending: pending.length,
      noEmail,
      from: `${from.name} <${from.address}>`,
      ...(emailConfigured ? {} : { reason: "email sending is not configured" }),
    });

  const origin = publicBaseUrl(req);
  let sent = 0;
  let failed = 0;
  for (const m of targets) {
    const token = m.agreement_token ?? randomBytes(24).toString("hex");
    const html = renderAgreementEmail({
      firstName: firstNameOf(m),
      clientName: campaign.client_name,
      agreeUrl: `${origin}/agree/${token}`,
      thenCommunity: Boolean(campaign.invite_url),
      senderName: from.name,
      senderRole: from.role,
      signature: from.signature,
      logoUrl: campaign.sender_member_id ? null : logoUrl,
    });
    const result = await sendPaced({
      from: `${from.name} <${from.address}>`,
      to: m.email,
      replyTo: from.replyTo,
      subject: "One click before your Intendrix journey starts",
      html,
    });
    if (result.ok) {
      await pool.query(
        `update members set agreement_sent_at = now(), agreement_token = $2
          where id = $1`,
        [m.id, token]
      );
      sent++;
    } else failed++;
  }

  return NextResponse.json({ ok: true, sent, failed, signed: signed.length });
}
