// POST /api/send-step — send ONE lesson of ONE campaign to its members,
// right now, because a signed-in Phoenix admin explicitly asked for it.
//
// This is the surgical counterpart to the daily engine: it touches
// nothing but the requested lesson and campaign, so sending one client's
// email today can never set off anyone else's. It ignores the due date
// (the click replaces the calendar) but keeps every other safety rule:
//  * a paused or closed campaign refuses;
//  * a cancelled lesson refuses;
//  * one log row per member — whoever already has this lesson is skipped,
//    so a second click can never double-send;
//  * the master switch is reported but not required: it governs the
//    automatic engine, while this send happens only because a person is
//    asking for exactly it, with the numbers in front of them.
//
// ?dryrun=1 only reports who would get it and writes nothing — the
// confirmation dialog is built from that report.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import {
  emailConfigured,
  personalize,
  renderLessonEmail,
  sendEmail,
} from "@/lib/server/email";
import { FALLBACK_SENDING_ADDRESS as DEFAULT_SENDING_ADDRESS } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SENDING_ADDRESS = process.env.SENDING_ADDRESS || DEFAULT_SENDING_ADDRESS;

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status });

  if (!dbConfigured)
    return NextResponse.json({
      ok: false,
      reason: "the app is running on this browser only — connect the database first",
    });

  const pool = getPool();

  // real sends are for the Phoenix side only, never a client admin
  if (who.userId) {
    const profile = await getProfile(pool, who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return NextResponse.json(
        { ok: false, reason: "only a Phoenix admin can send lessons" },
        { status: 403 }
      );
  } else if (authEnforced) {
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 });
  }
  const { campaignId, stepId } = body ?? {};
  if (!campaignId || !stepId)
    return NextResponse.json(
      { ok: false, reason: "campaign and lesson are required" },
      { status: 400 }
    );
  const dryRun =
    new URL(req.url).searchParams.get("dryrun") === "1" || body?.dryrun === true;

  const { rows: campaignRows } = await pool.query(
    `select c.id, c.code, c.name, c.timezone, c.status_override,
            c.sender_member_id, c.shadow_emails,
            cl.id as client_id, cl.name as client_name,
            cl.phoenix_leader_id, cl.phoenix_coach_id, cl.project_manager_id
       from campaigns c join clients cl on cl.id = c.client_id
      where c.id = $1`,
    [campaignId]
  );
  const campaign = campaignRows[0];
  const { rows: stepRows } = await pool.query(
    `select id, title, code from series_steps where id = $1`,
    [stepId]
  );
  const step = stepRows[0];
  if (!campaign || !step)
    return NextResponse.json(
      { ok: false, reason: "that campaign or lesson no longer exists" },
      { status: 404 }
    );

  if (campaign.status_override === "paused" || campaign.status_override === "closed")
    return NextResponse.json({
      ok: false,
      reason: `this campaign is ${campaign.status_override} — reopen it first`,
    });

  const skipped = await pool
    .query(
      `select 1 from campaign_step_skips where campaign_id = $1 and step_id = $2`,
      [campaignId, stepId]
    )
    .then((r) => r.rows.length > 0)
    .catch(() => false);
  if (skipped)
    return NextResponse.json({
      ok: false,
      reason: "this email is cancelled for this campaign — restore it first",
    });

  const [{ rows: members }, { rows: contents }, { rows: logged }, { rows: assignments }] =
    await Promise.all([
      pool.query(
        `select id, name, first_name, email, role from members
          where client_id = $1 order by name`,
        [campaign.client_id]
      ),
      pool.query(
        `select id, variant, email_subject, email_body, lesson_label, lesson_url,
                attachment_label, attachment_url, team_meeting
           from step_contents where step_id = $1`,
        [stepId]
      ),
      pool.query(
        `select member_id, shadow_to from email_sends
          where campaign_id = $1 and step_id = $2`,
        [campaignId, stepId]
      ),
      pool.query(
        `select staff_id, role from campaign_phoenix_assignments
          where campaign_id = $1 order by created_at`,
        [campaignId]
      ),
    ]);

  const byVariant: Record<string, any> = {};
  for (const c of contents) byVariant[c.variant] = c;
  if (!contents.length)
    return NextResponse.json({ ok: false, reason: "this lesson has no email yet" });

  // whoever already has a log row for this lesson is never sent it again
  const already = new Set(
    logged.map((r: any) => String(r.shadow_to ?? r.member_id))
  );

  // the same sender resolution the engine uses
  const pickStaffId = (role: string, fallback: string | null) =>
    assignments.find((a: any) => a.role === role)?.staff_id ?? fallback;
  const staffId =
    pickStaffId("phoenix_coach", campaign.phoenix_coach_id) ??
    pickStaffId("phoenix_leader", campaign.phoenix_leader_id) ??
    pickStaffId("project_manager", campaign.project_manager_id);

  let from:
    | { name: string; address: string; replyTo: string; role: string | null; signature: string | null }
    | null = null;
  let senderStaffId: string | null = null;
  if (campaign.sender_member_id) {
    const { rows } = await pool.query(
      `select name, email, title from members where id = $1`,
      [campaign.sender_member_id]
    );
    if (rows[0])
      from = {
        name: rows[0].name,
        address: SENDING_ADDRESS,
        replyTo: rows[0].email || SENDING_ADDRESS,
        role: rows[0].title ?? null,
        signature: null,
      };
  }
  if (!from && staffId) {
    const { rows } = await pool.query(
      `select id, name, email, role_title, signature from staff where id = $1`,
      [staffId]
    );
    if (rows[0]) {
      senderStaffId = rows[0].id;
      from = {
        name: rows[0].name,
        address: rows[0].email,
        replyTo: rows[0].email,
        role: rows[0].role_title ?? null,
        signature: rows[0].signature ?? null,
      };
    }
  }
  if (!from)
    return NextResponse.json({
      ok: false,
      reason: "this campaign has no sender yet — assign a Phoenix Coach first",
    });

  const watchers = String(campaign.shadow_emails ?? "")
    .split(/[,\n;]/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.includes("@"));

  const toMembers = members.filter((m: any) => !already.has(String(m.id)));
  const toWatchers = watchers.filter((a: string) => !already.has(a));

  const engineOn = await pool
    .query(`select value from app_settings where key = 'sendingEnabled'`)
    .then((r) => r.rows[0]?.value === "on")
    .catch(() => false);

  if (dryRun || !emailConfigured)
    return NextResponse.json({
      ok: true,
      dryRun: true,
      members: toMembers.length,
      watchers: toWatchers.length,
      alreadySent: already.size,
      noEmail: toMembers.filter((m: any) => !m.email).length,
      from: `${from.name} <${from.address}>`,
      engineOn,
      ...(emailConfigured
        ? {}
        : { reason: "email sending is not configured (no RESEND_API_KEY)" }),
    });

  const logoUrl = await pool
    .query(`select value from app_settings where key = 'signatureLogoUrl'`)
    .then((r) => r.rows[0]?.value ?? null)
    .catch(() => null);
  const overrides = await pool
    .query(
      `select variant, email_subject, email_body from campaign_step_content
        where campaign_id = $1 and step_id = $2`,
      [campaignId, stepId]
    )
    .then((r) => r.rows)
    .catch(() => []);
  const worded = (content: any) => {
    const o = overrides.find((x: any) => x.variant === content.variant);
    return {
      subject: o?.email_subject ?? content.email_subject,
      body: o?.email_body ?? content.email_body,
    };
  };
  const extrasByContent = new Map<string, any[]>();
  for (const c of contents) {
    const { rows } = await pool.query(
      `select label, url from step_links where step_content_id = $1 order by sort_order`,
      [c.id]
    );
    extrasByContent.set(c.id, rows);
  }

  // same pacing as the engine: the provider allows ~2 requests a second
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sendPaced = async (mail: Parameters<typeof sendEmail>[0]) => {
    let result = await sendEmail(mail);
    if (!result.ok && /429|rate_limit/i.test(result.error ?? "")) {
      await sleep(1600);
      result = await sendEmail(mail);
    }
    await sleep(550);
    return result;
  };

  const logRow = (
    memberId: string | null,
    variant: string,
    status: string,
    error: string | null,
    shadowTo: string | null = null
  ) =>
    pool.query(
      `insert into email_sends
         (campaign_id, step_id, member_id, variant, sender_id,
          scheduled_for, sent_at, status, error, shadow_to)
       values ($1, $2, $3, $4, $5, now(),
               case when $6 = 'sent' then now() end, $6, $7, $8)`,
      [campaignId, stepId, memberId, variant, senderStaffId, status, error, shadowTo]
    );

  const renderFor = (content: any, mergeBody: Record<string, any>) =>
    renderLessonEmail({
      body: personalize(worded(content).body ?? "", mergeBody),
      lesson:
        content.lesson_label || content.lesson_url
          ? { label: content.lesson_label ?? "Open the lesson", url: content.lesson_url }
          : null,
      extras: (extrasByContent.get(content.id) ?? []).map((l: any) => ({
        label: l.label,
        url: l.url,
      })),
      teamMeeting: content.team_meeting,
      senderName: from!.name,
      senderRole: from!.role,
      signature: from!.signature,
      logoUrl: campaign.sender_member_id ? null : logoUrl,
    });
  const attachmentsOf = (content: any) =>
    content.attachment_url
      ? [{
          filename: content.attachment_label || "attachment.pdf",
          path: content.attachment_url,
        }]
      : undefined;

  let sent = 0;
  let failed = 0;

  for (const member of toMembers) {
    const variant = member.role === "participant" ? "participant" : "leader";
    const content = byVariant[variant] ?? byVariant.participant;
    if (!content) continue;
    if (!member.email) {
      await logRow(member.id, variant, "failed", "member has no email address");
      failed++;
      continue;
    }
    const merge = {
      firstName:
        member.first_name || String(member.name ?? "").trim().split(/\s+/)[0],
      name: member.name,
      client: campaign.client_name,
      sender: from.name,
    };
    const result = await sendPaced({
      from: `${from.name} <${from.address}>`,
      to: member.email,
      replyTo: from.replyTo,
      subject: personalize(worded(content).subject || step.title, merge),
      html: renderFor(content, merge),
      attachments: attachmentsOf(content),
    });
    await logRow(
      member.id,
      variant,
      result.ok ? "sent" : "failed",
      result.ok ? null : (result.error ?? "unknown error")
    );
    if (result.ok) sent++;
    else failed++;
  }

  for (const address of toWatchers) {
    const content = byVariant.participant ?? byVariant.leader;
    if (!content) continue;
    const merge = {
      firstName: "there",
      client: campaign.client_name,
      sender: from.name,
    };
    const result = await sendPaced({
      from: `${from.name} <${from.address}>`,
      to: address,
      replyTo: from.replyTo,
      subject: `[${campaign.client_name} · copy] ${worded(content).subject || step.title}`,
      html: renderFor(content, merge),
      attachments: attachmentsOf(content),
    });
    await logRow(
      null,
      "participant",
      result.ok ? "sent" : "failed",
      result.ok ? null : (result.error ?? "unknown error"),
      address
    );
    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    alreadySent: already.size,
    engineOn,
  });
}
