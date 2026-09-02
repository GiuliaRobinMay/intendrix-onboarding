// POST /api/test-email — send one lesson to yourself, exactly as a member
// would receive it: same sender, same personalisation, same signature,
// same links. The only differences are a banner at the top and a [TEST]
// subject, so a test can never be mistaken for the real thing.
//
// It goes to the signed-in person's own address and nowhere else. That
// keeps a "preview" from becoming a way to mail anyone.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, verifyUser } from "@/lib/server/auth";
import {
  emailConfigured,
  personalize,
  renderLessonEmail,
  sendEmail,
} from "@/lib/server/email";
import { FALLBACK_SENDING_ADDRESS as DEFAULT_SENDING_ADDRESS } from "@/lib/store";

export const dynamic = "force-dynamic";

const SENDING_ADDRESS = process.env.SENDING_ADDRESS || DEFAULT_SENDING_ADDRESS;

/** Resend's own address, which needs no verified domain. It only ever
 *  delivers to the account owner, so it is useless for real sending and
 *  exactly right for reading a draft before the DNS records land. */
const TEST_RELAY_ADDRESS = process.env.TEST_RELAY_ADDRESS || "onboarding@resend.dev";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ sent: false, reason: "sign in first" }, { status: who.status });

  if (!dbConfigured)
    return NextResponse.json({
      sent: false,
      reason: "the app is running on this browser only — connect the database first",
    });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sent: false, reason: "invalid body" }, { status: 400 });
  }
  const { campaignId, stepId, variant } = body ?? {};
  if (!campaignId || !stepId)
    return NextResponse.json(
      { sent: false, reason: "campaign and lesson are required" },
      { status: 400 }
    );

  const pool = getPool();

  // Where it goes: the signed-in person's own address. In open mode
  // (no sign-in configured yet) fall back to a team address, which is
  // still an address we control.
  let to: string | null = null;
  if (who.userId) {
    // their own address, or the team row their account is linked to
    const { rows } = await pool.query(
      `select coalesce(p.email, s.email) as email
         from profiles p left join staff s on s.id = p.staff_id
        where p.id = $1`,
      [who.userId]
    );
    to = rows[0]?.email ?? null;
  }

  const [campaignRows, stepRows] = await Promise.all([
    pool.query(
      `select c.id, c.code, c.name, c.sender_member_id,
              cl.id as client_id, cl.name as client_name,
              cl.phoenix_leader_id, cl.phoenix_coach_id, cl.project_manager_id
         from campaigns c join clients cl on cl.id = c.client_id
        where c.id = $1`,
      [campaignId]
    ),
    pool.query(
      `select id, title, code from series_steps where id = $1`,
      [stepId]
    ),
  ]);
  const campaign = campaignRows.rows[0];
  const step = stepRows.rows[0];
  if (!campaign || !step)
    return NextResponse.json(
      { sent: false, reason: "that campaign or lesson no longer exists" },
      { status: 404 }
    );

  const wanted = variant === "leader" ? "leader" : "participant";
  const { rows: contents } = await pool.query(
    `select id, variant, email_subject, email_body, lesson_label, lesson_url,
            attachment_label, attachment_url, team_meeting
       from step_contents where step_id = $1`,
    [stepId]
  );
  const content =
    contents.find((c: any) => c.variant === wanted) ?? contents[0];
  if (!content)
    return NextResponse.json({ sent: false, reason: "this lesson has no email yet" });

  const { rows: extras } = await pool.query(
    `select label, url from step_links where step_content_id = $1 order by sort_order`,
    [content.id]
  );

  // the same sender resolution the engine uses
  const { rows: assignments } = await pool.query(
    `select staff_id, role from campaign_phoenix_assignments
      where campaign_id = $1 order by created_at`,
    [campaign.id]
  );
  const pickStaffId = (role: string, fallback: string | null) =>
    assignments.find((a: any) => a.role === role)?.staff_id ?? fallback;
  const staffId =
    pickStaffId("phoenix_coach", campaign.phoenix_coach_id) ??
    pickStaffId("phoenix_leader", campaign.phoenix_leader_id) ??
    pickStaffId("project_manager", campaign.project_manager_id);

  let from: { name: string; address: string; replyTo: string; role: string | null; signature: string | null } | null =
    null;
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
      `select name, email, role_title, signature from staff where id = $1`,
      [staffId]
    );
    if (rows[0])
      from = {
        name: rows[0].name,
        address: rows[0].email,
        replyTo: rows[0].email,
        role: rows[0].role_title ?? null,
        signature: rows[0].signature ?? null,
      };
  }
  if (!from)
    return NextResponse.json({
      sent: false,
      reason: "this campaign has no sender yet — assign a Phoenix Coach first",
    });

  // Open mode (no sign-in configured yet): there is no account to send to,
  // so the test goes to the coach whose address it would come from.
  if (!to && !authEnforced) to = from.replyTo;
  if (!to)
    return NextResponse.json({
      sent: false,
      reason: "no address on your account — add your email on the Team page",
    });

  // personalised against the person asking for the test, so they see
  // exactly what a merge field turns into
  const merge = {
    firstName: to.split("@")[0].split(/[._-]/)[0].replace(/^./, (c) => c.toUpperCase()),
    name: to,
    client: campaign.client_name,
    sender: from.name,
  };
  const settingRows = await pool
    .query(`select key, value from app_settings`)
    .then((r) => r.rows)
    .catch(() => []);
  const appSettings: Record<string, string> = {};
  for (const r of settingRows) appSettings[r.key] = r.value;
  const subjectPrefix = (appSettings.subjectPrefix ?? "").trim();
  const html = renderLessonEmail({
    body: personalize(content.email_body ?? "", merge),
    lesson:
      content.lesson_label || content.lesson_url
        ? { label: content.lesson_label ?? "Open the lesson", url: content.lesson_url }
        : null,
    extras: extras.map((l: any) => ({ label: l.label, url: l.url })),
    teamMeeting: content.team_meeting,
    senderName: from.name,
    senderRole: from.role,
    signature: from.signature,
    logoUrl: campaign.sender_member_id ? null : (appSettings.signatureLogoUrl ?? null),
    test: true,
  });
  const subject = `[TEST] ${subjectPrefix ? `${subjectPrefix} ` : ""}${personalize(
    content.email_subject || step.title,
    merge
  )}`;

  if (!emailConfigured)
    return NextResponse.json({
      sent: false,
      reason: "email sending is not switched on yet (no RESEND_API_KEY)",
      preview: { to, from: `${from.name} <${from.address}>`, subject },
    });

  const attachments = content.attachment_url
    ? [{
        filename: content.attachment_label || "attachment.pdf",
        path: content.attachment_url,
      }]
    : undefined;
  const result = await sendEmail({
    from: `${from.name} <${from.address}>`,
    to,
    replyTo: from.replyTo,
    subject,
    html,
    attachments,
  });
  if (result.ok)
    return NextResponse.json({ sent: true, to, variant: content.variant });

  // Before the sending domain is verified the provider refuses the real
  // from-address. A test is for reading the email, not for proving the
  // domain, so send it from the provider's own test address instead —
  // same content, same name, same links. Real sends are untouched: they
  // wait for the domain, as they must.
  if (/not verified|domain is not/i.test(result.error ?? "")) {
    const relayed = await sendEmail({
      from: `${from.name} (via Intendrix) <${TEST_RELAY_ADDRESS}>`,
      to,
      replyTo: from.replyTo,
      subject,
      html,
      attachments,
    });
    if (relayed.ok)
      return NextResponse.json({
        sent: true,
        to,
        variant: content.variant,
        note: `Sent from the test address — ${from.address.split("@")[1]} is not verified with the provider yet, so real lessons still cannot go out.`,
      });
    return NextResponse.json(
      {
        sent: false,
        reason: `${from.address.split("@")[1]} is not verified with the provider yet, and the test address failed too — ${relayed.error ?? "unknown error"}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
        { sent: false, reason: result.error ?? "unknown error" },
        { status: 502 }
      );
}
