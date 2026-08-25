// GET /api/state — the whole app state assembled from the database, in
// exactly the shape lib/state.tsx keeps in memory. Returns
// { configured: false } when no DATABASE_URL is set, so the app falls
// back to the browser-storage prototype.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import type {
  Campaign,
  CampaignTemplate,
  Client,
  Invitation,
  SeriesTemplate,
  SessionKey,
  StepContent,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const TRIGGER_LABELS: Record<SessionKey, string> = {
  orientation: "Orientation Session",
  workshop: "Workshop",
  coaching1: "Coaching Session 1",
  coaching2: "Coaching Session 2",
  launch: "Launch Session",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET() {
  if (!dbConfigured) return NextResponse.json({ configured: false });

  const pool = getPool();
  const q = async (text: string) => (await pool.query(text)).rows;

  try {
    const [
      clients,
      members,
      campaigns,
      sessions,
      loadedSeries,
      pAssign,
      cAssign,
      invitations,
      cTemplates,
      sTemplates,
      steps,
      contents,
      links,
    ] = await Promise.all([
      q(`select id, name, short_name, location, sector, status,
                phoenix_leader_id, phoenix_coach_id, project_manager_id,
                space_url, invite_url
           from clients order by created_at, id`),
      q(`select id, client_id, name, email, role, title
           from members order by created_at, id`),
      q(`select id, client_id, template_id, code, name, timezone,
                status_override, start_date::text as start_date,
                end_date::text as end_date
           from campaigns order by created_at, id`),
      q(`select id, campaign_id, name, session_date::text as session_date,
                mode, kind
           from campaign_sessions order by campaign_id, sort_order, created_at`),
      q(`select campaign_id, series_template_id, trigger_session_id
           from campaign_series order by campaign_id, sort_order, created_at`),
      q(`select id, campaign_id, staff_id, role
           from campaign_phoenix_assignments order by created_at, id`),
      q(`select id, campaign_id, member_id, role
           from campaign_client_assignments order by created_at, id`),
      q(`select id, email, role, client_id
           from invitations where accepted_at is null order by created_at, id`),
      q(`select id, code, name, description
           from campaign_templates order by created_at, id`),
      q(`select id, campaign_template_id, code, name, focus, trigger_kind, color
           from series_templates order by sort_order, created_at, id`),
      q(`select id, series_template_id, code, title, offset_days,
                to_char(send_time, 'HH24:MI') as send_time
           from series_steps order by series_template_id, sort_order, created_at`),
      q(`select id, step_id, variant, email_subject, email_body,
                lesson_label, lesson_url, team_meeting, note
           from step_contents`),
      q(`select step_content_id, label, url
           from step_links order by sort_order, id`),
    ]);

    const linksByContent = new Map<string, Array<{ label: string; url: string | null }>>();
    for (const l of links) {
      const list = linksByContent.get(l.step_content_id) ?? [];
      list.push({ label: l.label, url: l.url });
      linksByContent.set(l.step_content_id, list);
    }

    const contentByStep = new Map<string, Record<string, StepContent>>();
    for (const c of contents) {
      const extras = linksByContent.get(c.id);
      const content: StepContent = {
        emailSubject: c.email_subject,
        emailBody: c.email_body,
        ...(c.lesson_label || c.lesson_url
          ? { lesson: { label: c.lesson_label ?? "", url: c.lesson_url } }
          : {}),
        ...(extras && extras.length ? { extras } : {}),
        ...(c.team_meeting ? { teamMeeting: c.team_meeting } : {}),
        ...(c.note ? { note: c.note } : {}),
      };
      const both = contentByStep.get(c.step_id) ?? {};
      both[c.variant] = content;
      contentByStep.set(c.step_id, both);
    }

    const blank: StepContent = { emailSubject: "", emailBody: "" };
    const stepsBySeries = new Map<string, any[]>();
    for (const s of steps) {
      const both = contentByStep.get(s.id) ?? {};
      const list = stepsBySeries.get(s.series_template_id) ?? [];
      list.push({
        id: s.id,
        code: s.code,
        title: s.title,
        offsetDays: s.offset_days,
        sendTime: s.send_time,
        participant: both.participant ?? blank,
        leader: both.leader ?? blank,
      });
      stepsBySeries.set(s.series_template_id, list);
    }

    const templates: SeriesTemplate[] = sTemplates.map((t: any) => ({
      id: t.id,
      campaignTemplateId: t.campaign_template_id,
      code: t.code,
      name: t.name,
      focus: t.focus,
      trigger: t.trigger_kind,
      triggerLabel: TRIGGER_LABELS[t.trigger_kind as SessionKey] ?? t.trigger_kind,
      color: t.color,
      steps: stepsBySeries.get(t.id) ?? [],
    }));

    const campaignTemplates: CampaignTemplate[] = cTemplates.map((t: any) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
    }));

    const sessionsByCampaign = new Map<string, any[]>();
    for (const s of sessions) {
      const list = sessionsByCampaign.get(s.campaign_id) ?? [];
      list.push({
        id: s.id,
        name: s.name,
        date: s.session_date,
        mode: s.mode,
        ...(s.kind ? { kind: s.kind } : {}),
      });
      sessionsByCampaign.set(s.campaign_id, list);
    }

    const seriesByCampaign = new Map<string, any[]>();
    for (const s of loadedSeries) {
      const list = seriesByCampaign.get(s.campaign_id) ?? [];
      list.push({ templateId: s.series_template_id, sessionId: s.trigger_session_id });
      seriesByCampaign.set(s.campaign_id, list);
    }

    const pByCampaign = new Map<string, any[]>();
    for (const a of pAssign) {
      const list = pByCampaign.get(a.campaign_id) ?? [];
      list.push({ id: a.id, staffId: a.staff_id, role: a.role });
      pByCampaign.set(a.campaign_id, list);
    }

    const cByCampaign = new Map<string, any[]>();
    for (const a of cAssign) {
      const list = cByCampaign.get(a.campaign_id) ?? [];
      list.push({ id: a.id, memberId: a.member_id, role: a.role });
      cByCampaign.set(a.campaign_id, list);
    }

    const campaignsByClient = new Map<string, Campaign[]>();
    for (const c of campaigns) {
      const campaign: Campaign = {
        id: c.id,
        code: c.code,
        name: c.name,
        timezone: c.timezone,
        ...(c.template_id ? { templateId: c.template_id } : {}),
        phoenixTeam: pByCampaign.get(c.id) ?? [],
        clientTeam: cByCampaign.get(c.id) ?? [],
        ...(c.status_override ? { statusOverride: c.status_override } : {}),
        startDate: c.start_date,
        endDate: c.end_date,
        sessions: sessionsByCampaign.get(c.id) ?? [],
        series: seriesByCampaign.get(c.id) ?? [],
      };
      const list = campaignsByClient.get(c.client_id) ?? [];
      list.push(campaign);
      campaignsByClient.set(c.client_id, list);
    }

    const membersByClient = new Map<string, any[]>();
    for (const m of members) {
      const list = membersByClient.get(m.client_id) ?? [];
      list.push({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        ...(m.title ? { title: m.title } : {}),
      });
      membersByClient.set(m.client_id, list);
    }

    const clientList: Client[] = clients.map((c: any) => ({
      id: c.id,
      name: c.name,
      shortName: c.short_name,
      location: c.location,
      sector: c.sector,
      status: c.status,
      ...(c.phoenix_leader_id ? { phoenixLeaderId: c.phoenix_leader_id } : {}),
      ...(c.phoenix_coach_id ? { phoenixCoachId: c.phoenix_coach_id } : {}),
      ...(c.project_manager_id ? { projectManagerId: c.project_manager_id } : {}),
      ...(c.space_url ? { spaceUrl: c.space_url } : {}),
      ...(c.invite_url ? { inviteUrl: c.invite_url } : {}),
      members: membersByClient.get(c.id) ?? [],
      campaigns: campaignsByClient.get(c.id) ?? [],
    }));

    const invitationList: Invitation[] = invitations.map((i: any) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      ...(i.client_id ? { clientId: i.client_id } : {}),
    }));

    return NextResponse.json({
      configured: true,
      db: {
        clients: clientList,
        invitations: invitationList,
        campaignTemplates,
        templates,
      },
    });
  } catch (err) {
    console.error("GET /api/state failed:", err);
    return NextResponse.json(
      { configured: true, error: "database unreachable" },
      { status: 500 }
    );
  }
}
