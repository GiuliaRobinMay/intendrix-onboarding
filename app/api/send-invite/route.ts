// POST /api/send-invite — invite a campaign's members into the client's
// community space, each via the client's own plan link. The gate Tom
// asked for lives here: only people who have ACCEPTED the user agreement
// are invited — nobody proceeds into the community without it. People
// who already joined (or were already invited, unless remind: true) are
// skipped. ?dryrun=1 only counts.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { emailConfigured, renderInviteEmail } from "@/lib/server/email";
import {
  campaignContext,
  firstNameOf,
  NEW_MEMBER_GUIDE_FILENAME,
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
  const { campaign, from, logoUrl, guideUrl } = ctx;
  if (!campaign.invite_url)
    return NextResponse.json({
      ok: false,
      reason:
        "this client has no community invitation link yet — paste their plan link into the Invite field on the client page first",
    });

  const { rows: members } = await pool
    .query(
      `select id, name, first_name, email,
              agreement_signed_at, community_invited_at, community_joined_at
         from members where client_id = $1 order by name`,
      [campaign.client_id]
    )
    .catch(() => ({ rows: null }));
  if (!members)
    return NextResponse.json({
      ok: false,
      reason:
        "the database does not have the onboarding update yet — paste migration 0015 into the Supabase SQL editor first",
    });

  const joined = members.filter((m: any) => m.community_joined_at);
  const notJoined = members.filter((m: any) => !m.community_joined_at);
  const needAgreement = notJoined.filter((m: any) => !m.agreement_signed_at);
  const invited = notJoined.filter(
    (m: any) => m.agreement_signed_at && m.community_invited_at
  );
  const fresh = notJoined.filter(
    (m: any) => m.agreement_signed_at && !m.community_invited_at
  );
  const targets = (remind ? invited : fresh).filter((m: any) => m.email);
  const noEmail = (remind ? invited : fresh).filter((m: any) => !m.email).length;

  if (dryRun || !emailConfigured)
    return NextResponse.json({
      ok: true,
      dryRun: true,
      toSend: targets.length,
      joined: joined.length,
      invited: invited.length,
      needAgreement: needAgreement.length,
      noEmail,
      from: `${from.name} <${from.address}>`,
      ...(emailConfigured ? {} : { reason: "email sending is not configured" }),
    });

  let sent = 0;
  let failed = 0;
  for (const m of targets) {
    const html = renderInviteEmail({
      firstName: firstNameOf(m),
      clientName: campaign.client_name,
      inviteUrl: campaign.invite_url,
      senderName: from.name,
      senderRole: from.role,
      signature: from.signature,
      logoUrl: campaign.sender_member_id ? null : logoUrl,
    });
    const result = await sendPaced({
      from: `${from.name} <${from.address}>`,
      to: m.email,
      replyTo: from.replyTo,
      subject: `Your access to the ${campaign.client_name} space on Intendrix`,
      html,
      attachments: [{ filename: NEW_MEMBER_GUIDE_FILENAME, path: guideUrl }],
    });
    if (result.ok) {
      await pool.query(
        `update members set community_invited_at = now() where id = $1`,
        [m.id]
      );
      sent++;
    } else failed++;
  }

  return NextResponse.json({ ok: true, sent, failed, joined: joined.length });
}
