// GET /api/cron/send — the sending engine. Vercel Cron calls this on a
// schedule; each run finds lesson emails that are due and sends them
// from the responsible's address (Coach → Leader → Project Manager),
// honoring pauses and each campaign's timezone, and logs every send in
// email_sends.
//
// Safety rules:
//  * a paused or closed campaign sends nothing;
//  * anything more than GRACE_DAYS overdue is logged as "held", never
//    auto-sent — switching the engine on can't flood members with a
//    backlog;
//  * one log row per member per lesson — a rerun never double-sends;
//  * without RESEND_API_KEY (or with ?dryrun=1) the run only reports
//    what it would do and writes nothing.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced } from "@/lib/server/auth";
import {
  emailConfigured,
  personalize,
  renderLessonEmail,
  sendEmail,
} from "@/lib/server/email";
import { FALLBACK_SENDING_ADDRESS as DEFAULT_SENDING_ADDRESS } from "@/lib/store";
import { addWorkdays } from "@/lib/workdays";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRACE_DAYS = 2;

/** The address a client member's email leaves from. Override with
 *  SENDING_ADDRESS once the domain is not phoenixperform.com. */
const FALLBACK_SENDING_ADDRESS =
  process.env.SENDING_ADDRESS || DEFAULT_SENDING_ADDRESS;

/* eslint-disable @typescript-eslint/no-explicit-any */

function nowInZone(tz: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(toIso) - p(fromIso)) / 86400000);
}

export async function GET(req: Request) {
  // Vercel Cron authenticates with the CRON_SECRET env var
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (secret) {
    if (header !== `Bearer ${secret}`)
      return NextResponse.json({ error: "not allowed" }, { status: 401 });
  } else if (authEnforced) {
    return NextResponse.json(
      { error: "set CRON_SECRET before running the engine" },
      { status: 503 }
    );
  }

  if (!dbConfigured)
    return NextResponse.json({ configured: false, sent: 0, held: 0 });

  const dryRun =
    !emailConfigured || new URL(req.url).searchParams.get("dryrun") === "1";

  const pool = getPool();

  // The master switch (Settings → Email sending). Until a human turns it
  // on, the engine only ever reports — it delivers nothing and writes
  // nothing, no matter what is due or verified.
  const engineOn = await pool
    .query(`select value from app_settings where key = 'sendingEnabled'`)
    .then((r) => r.rows[0]?.value === "on")
    .catch(() => false);
  if (!engineOn && !dryRun)
    return NextResponse.json({
      enabled: false,
      note: "email sending is switched OFF in Settings — nothing was sent, nothing was logged",
      sent: 0,
      failed: 0,
      held: 0,
    });
  const q = async (text: string, params: any[] = []) =>
    (await pool.query(text, params)).rows;

  const [campaigns, clients, members, staff, loaded, sessions, steps, contents, links, logged, logoRows, overrideRows, skipRows] =
    await Promise.all([
      q(`select id, client_id, code, name, timezone, status_override,
                sender_member_id, shadow_emails from campaigns`),
      q(`select id, name, phoenix_leader_id, phoenix_coach_id, project_manager_id from clients`),
      q(`select id, client_id, name, first_name, email, role, title from members`),
      q(`select id, name, email, role_title, signature from staff`),
      q(`select campaign_id, series_template_id, trigger_session_id
           from campaign_series order by campaign_id, sort_order, created_at`),
      q(`select id, session_date::text as session_date from campaign_sessions`),
      q(`select id, series_template_id, code, title, offset_days,
                to_char(send_time, 'HH24:MI') as send_time
           from series_steps order by series_template_id, sort_order, created_at`),
      q(`select id, step_id, variant, email_subject, email_body,
                lesson_label, lesson_url, attachment_label, attachment_url,
                team_meeting from step_contents`),
      q(`select step_content_id, label, url from step_links order by sort_order`),
      q(`select campaign_id, step_id, member_id, shadow_to from email_sends`),
      q(`select value from app_settings where key = 'signatureLogoUrl'`).catch(() => []),
      q(`select campaign_id, step_id, variant, email_subject, email_body
           from campaign_step_content`).catch(() => []),
      q(`select campaign_id, step_id from campaign_step_skips`).catch(() => []),
    ]);

  // the company logo under every Phoenix sign-off; client champions keep
  // their own plain block — their organisation is not Phoenix
  const logoUrl: string | null = logoRows[0]?.value ?? null;

  // a campaign's own wording of a lesson, when it has one — it wins over
  // the master, field by field
  const overrideByKey = new Map<string, any>();
  for (const o of overrideRows)
    overrideByKey.set(`${o.campaign_id}|${o.step_id}|${o.variant}`, o);
  const worded = (campaign: any, step: any, content: any) => {
    const o = overrideByKey.get(`${campaign.id}|${step.id}|${content.variant}`);
    return {
      subject: o?.email_subject ?? content.email_subject,
      body: o?.email_body ?? content.email_body,
    };
  };

  // lessons cancelled by hand — this campaign never sends them, to
  // members or to the watching copies, and nothing is logged for them
  const cancelled = new Set(
    skipRows.map((r: any) => `${r.campaign_id}|${r.step_id}`)
  );

  const clientById = new Map(clients.map((c: any) => [c.id, c]));
  const staffById = new Map(staff.map((s: any) => [s.id, s]));
  const sessionDate = new Map(sessions.map((s: any) => [s.id, s.session_date]));
  const membersByClient = new Map<string, any[]>();
  for (const m of members) {
    const list = membersByClient.get(m.client_id) ?? [];
    list.push(m);
    membersByClient.set(m.client_id, list);
  }
  const stepsBySeries = new Map<string, any[]>();
  for (const s of steps) {
    const list = stepsBySeries.get(s.series_template_id) ?? [];
    list.push(s);
    stepsBySeries.set(s.series_template_id, list);
  }
  const linksByContent = new Map<string, any[]>();
  for (const l of links) {
    const list = linksByContent.get(l.step_content_id) ?? [];
    list.push(l);
    linksByContent.set(l.step_content_id, list);
  }
  const contentByStep = new Map<string, Record<string, any>>();
  for (const c of contents) {
    const both = contentByStep.get(c.step_id) ?? {};
    both[c.variant] = c;
    contentByStep.set(c.step_id, both);
  }
  // one row per member per lesson, and one per shadow address per lesson
  const already = new Set(
    logged.map(
      (r: any) => `${r.campaign_id}|${r.step_id}|${r.shadow_to ?? r.member_id}`
    )
  );
  const assignments = await q(
    `select campaign_id, staff_id, role from campaign_phoenix_assignments
      order by created_at`
  );

  const memberById = new Map(members.map((m: any) => [m.id, m]));

  const senderFor = (campaign: any): any | null => {
    const client = clientById.get(campaign.client_id);
    const pick = (role: string, fallbackId?: string | null) => {
      const a = assignments.find(
        (x: any) => x.campaign_id === campaign.id && x.role === role
      );
      const id = a?.staff_id ?? fallbackId;
      return id ? staffById.get(id) : null;
    };
    return (
      pick("phoenix_coach", client?.phoenix_coach_id) ??
      pick("phoenix_leader", client?.phoenix_leader_id) ??
      pick("project_manager", client?.project_manager_id) ??
      null
    );
  };

  // What recipients actually see. A campaign can nominate one of the
  // client's own people — their name goes on the message and replies reach
  // them, but the from-address stays on our verified sending domain, since
  // mail wearing the client's own domain fails their anti-spoofing checks.
  const fromFor = (
    campaign: any,
    responsible: any
  ): {
    name: string;
    address: string;
    replyTo: string;
    role: string | null;
    signature: string | null;
  } | null => {
    if (campaign.sender_member_id) {
      const member = memberById.get(campaign.sender_member_id);
      if (member)
        return {
          name: member.name,
          address: FALLBACK_SENDING_ADDRESS,
          replyTo: member.email || responsible?.email || FALLBACK_SENDING_ADDRESS,
          role: member.title ?? null,
          signature: null, // a client's champion signs with name and title
        };
    }
    if (!responsible) return null;
    return {
      name: responsible.name,
      address: responsible.email,
      replyTo: responsible.email,
      role: responsible.role_title ?? null,
      signature: responsible.signature ?? null,
    };
  };

  /** The addresses watching this campaign without being on it. */
  const shadowsOf = (campaign: any): string[] =>
    String(campaign.shadow_emails ?? "")
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));

  // The provider allows roughly two requests per second; a launch-day
  // batch of thirty-six fired back to back trips its rate limit. Pace
  // every send, and give a rate-limited one a second chance.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sendPaced = async (
    mail: Parameters<typeof sendEmail>[0]
  ): Promise<Awaited<ReturnType<typeof sendEmail>>> => {
    let result = await sendEmail(mail);
    if (!result.ok && /429|rate_limit/i.test(result.error ?? "")) {
      await sleep(1600);
      result = await sendEmail(mail);
    }
    await sleep(550);
    return result;
  };

  let sent = 0;
  let failed = 0;
  let held = 0;
  let skippedPaused = 0;
  const wouldSend: any[] = [];

  // a database from before the delivery-status columns still logs fine
  const hasProviderCol = await pool
    .query(
      `select 1 from information_schema.columns
        where table_name = 'email_sends' and column_name = 'provider_id'`
    )
    .then((r) => r.rows.length > 0)
    .catch(() => false);

  const logRow = async (
    campaign: any,
    stepId: string,
    memberId: string | null,
    variant: string,
    senderId: string | null,
    localDate: string,
    time: string,
    status: string,
    error: string | null,
    shadowTo: string | null = null,
    providerId: string | null = null
  ) => {
    await pool.query(
      `insert into email_sends
         (campaign_id, step_id, member_id, variant, sender_id, scheduled_for,
          sent_at, status, error, shadow_to${hasProviderCol ? ", provider_id" : ""})
       values ($1, $2, $3, $4, $5,
               ($6 || ' ' || $7)::timestamp at time zone $8,
               case when $9 = 'sent' then now() end, $9, $10, $11${hasProviderCol ? ", $12" : ""})`,
      [campaign.id, stepId, memberId, variant, senderId, localDate, time,
       campaign.timezone, status, error, shadowTo ?? null,
       ...(hasProviderCol ? [providerId] : [])]
    );
  };

  for (const campaign of campaigns) {
    if (campaign.status_override === "paused" || campaign.status_override === "closed") {
      skippedPaused++;
      continue;
    }
    const now = nowInZone(campaign.timezone || "America/New_York");
    const sender = senderFor(campaign);
    const from = fromFor(campaign, sender);
    const clientMembers = membersByClient.get(campaign.client_id) ?? [];

    for (const ls of loaded.filter((x: any) => x.campaign_id === campaign.id)) {
      const baseDate = ls.trigger_session_id
        ? sessionDate.get(ls.trigger_session_id)
        : null;
      if (!baseDate) continue;
      // offsets count working days — the same rule the app shows
      let cursor = baseDate as string;
      for (const step of stepsBySeries.get(ls.series_template_id) ?? []) {
        cursor = addWorkdays(cursor, step.offset_days);
        const localDate = cursor;
        const time = step.send_time as string;
        const isDue =
          localDate < now.date || (localDate === now.date && time <= now.time);
        if (!isDue) break; // later steps in this series are even further out
        if (cancelled.has(`${campaign.id}|${step.id}`)) continue;
        const age = daysBetween(localDate, now.date);
        const stale = age > GRACE_DAYS;
        const both = contentByStep.get(step.id) ?? {};

        for (const member of clientMembers) {
          const variant = member.role === "participant" ? "participant" : "leader";
          const content = both[variant] ?? both.participant;
          if (!content) continue;
          if (already.has(`${campaign.id}|${step.id}|${member.id}`)) continue;

          if (dryRun) {
            if (!stale)
              wouldSend.push({
                campaign: campaign.code,
                step: step.code,
                from: from ? `${from.name} <${from.address}>` : "— no sender —",
                replyTo: from?.replyTo ?? null,
                to: member.email,
                variant,
                date: localDate,
                time,
              });
            else held++;
            continue;
          }

          already.add(`${campaign.id}|${step.id}|${member.id}`);
          if (stale) {
            await logRow(campaign, step.id, member.id, variant,
              sender?.id ?? null, localDate, time, "held",
              `overdue by ${age} days — review and send by hand`);
            held++;
            continue;
          }
          if (!from) {
            await logRow(campaign, step.id, member.id, variant, null,
              localDate, time, "held", "no responsible assigned — no sender address");
            held++;
            continue;
          }
          if (!member.email) {
            await logRow(campaign, step.id, member.id, variant, sender?.id ?? null,
              localDate, time, "failed", "member has no email address");
            failed++;
            continue;
          }
          const merge = {
            firstName:
              member.first_name || String(member.name ?? "").trim().split(/\s+/)[0],
            name: member.name,
            client: clientById.get(campaign.client_id)?.name,
            sender: from.name,
          };
          const text = worded(campaign, step, content);
          const html = renderLessonEmail({
            body: personalize(text.body ?? "", merge),
            lesson: content.lesson_label || content.lesson_url
              ? { label: content.lesson_label ?? "Open the lesson", url: content.lesson_url }
              : null,
            extras: (linksByContent.get(content.id) ?? []).map((l: any) => ({
              label: l.label,
              url: l.url,
            })),
            teamMeeting: content.team_meeting,
            senderName: from.name,
            senderRole: from.role,
            signature: from.signature,
            logoUrl: campaign.sender_member_id ? null : logoUrl,
          });
          const result = await sendPaced({
            from: `${from.name} <${from.address}>`,
            to: member.email,
            replyTo: from.replyTo,
            subject: personalize(text.subject || step.title, merge),
            html,
            attachments: content.attachment_url
              ? [{
                  filename: content.attachment_label || "attachment.pdf",
                  path: content.attachment_url,
                }]
              : undefined,
          });
          await logRow(campaign, step.id, member.id, variant, sender?.id ?? null,
            localDate, time, result.ok ? "sent" : "failed",
            result.ok ? null : (result.error ?? "unknown error"),
            null, result.id ?? null);
          if (result.ok) sent++;
          else failed++;
        }

        // One copy of each lesson for whoever is watching this campaign
        // from the outside — the coordinator, not a participant. Sent
        // once per lesson, never once per member.
        for (const address of shadowsOf(campaign)) {
          if (already.has(`${campaign.id}|${step.id}|${address}`)) continue;
          const content = both.participant ?? both.leader;
          if (!content || stale || !from) continue;

          if (dryRun) {
            wouldSend.push({
              campaign: campaign.code,
              step: step.code,
              from: `${from.name} <${from.address}>`,
              replyTo: from.replyTo,
              to: address,
              variant: "copy",
              date: localDate,
              time,
            });
            continue;
          }

          already.add(`${campaign.id}|${step.id}|${address}`);
          const text = worded(campaign, step, content);
          const html = renderLessonEmail({
            body: personalize(text.body ?? "", {
              firstName: "there",
              client: clientById.get(campaign.client_id)?.name,
              sender: from.name,
            }),
            lesson: content.lesson_label || content.lesson_url
              ? { label: content.lesson_label ?? "Open the lesson", url: content.lesson_url }
              : null,
            extras: (linksByContent.get(content.id) ?? []).map((l: any) => ({
              label: l.label,
              url: l.url,
            })),
            teamMeeting: content.team_meeting,
            senderName: from.name,
            senderRole: from.role,
            signature: from.signature,
            logoUrl: campaign.sender_member_id ? null : logoUrl,
          });
          const client = clientById.get(campaign.client_id);
          const result = await sendPaced({
            from: `${from.name} <${from.address}>`,
            to: address,
            replyTo: from.replyTo,
            subject: `[${client?.name ?? campaign.code} · copy] ${
              text.subject || step.title
            }`,
            html,
            attachments: content.attachment_url
              ? [{
                  filename: content.attachment_label || "attachment.pdf",
                  path: content.attachment_url,
                }]
              : undefined,
          });
          await logRow(campaign, step.id, null, "participant",
            sender?.id ?? null, localDate, time,
            result.ok ? "sent" : "failed",
            result.ok ? null : (result.error ?? "unknown error"),
            address, result.id ?? null);
          if (result.ok) sent++;
          else failed++;
        }
      }
    }
  }

  return NextResponse.json({
    configured: true,
    dryRun,
    sent,
    failed,
    held,
    skippedPaused,
    ...(dryRun ? { wouldSend: wouldSend.slice(0, 50), wouldSendCount: wouldSend.length } : {}),
  });
}
