// POST /api/action — persists one prototype action to the database.
// The client applies the action to its local state first (optimistic),
// then posts the exact same action here; this file is the SQL mirror of
// the reducer in lib/state.tsx. Ids are generated on the client and
// travel inside the action, so both sides stay in step.

import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { dbConfigured, getPool } from "@/lib/server/db";
import { actionAllowed, authEnforced, getProfile, verifyUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function reorder(
  tx: PoolClient,
  table: string,
  scopeCol: string,
  scopeVal: string,
  idCol: string,
  movedId: string,
  toIndex: number | null,
  dir: -1 | 1 | null
) {
  const { rows } = await tx.query(
    `select ${idCol} as id from ${table}
      where ${scopeCol} = $1 order by sort_order, created_at`,
    [scopeVal]
  );
  const ids = rows.map((r) => r.id as string);
  const from = ids.indexOf(movedId);
  if (from < 0) return;
  let to = toIndex ?? from + (dir ?? 0);
  to = Math.max(0, Math.min(to, ids.length - 1));
  if (from === to) return;
  ids.splice(from, 1);
  ids.splice(to, 0, movedId);
  for (let i = 0; i < ids.length; i++) {
    await tx.query(
      `update ${table} set sort_order = $1 where ${scopeCol} = $2 and ${idCol} = $3`,
      [i, scopeVal, ids[i]]
    );
  }
}

async function nextSort(
  tx: PoolClient,
  table: string,
  scopeCol: string,
  scopeVal: string
): Promise<number> {
  const { rows } = await tx.query(
    `select coalesce(max(sort_order), -1) + 1 as n from ${table} where ${scopeCol} = $1`,
    [scopeVal]
  );
  return rows[0].n;
}

/** Map a camelCase patch onto columns; missing keys are left untouched. */
async function patchRow(
  tx: PoolClient,
  table: string,
  id: string,
  patch: Record<string, any>,
  columns: Record<string, string>
) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [key, col] of Object.entries(columns)) {
    if (key in patch) {
      vals.push(patch[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return;
  vals.push(id);
  await tx.query(`update ${table} set ${sets.join(", ")} where id = $${vals.length}`, vals);
}

/** Auto-bind loaded series to the session matching their trigger kind. */
async function insertLoadedSeries(
  tx: PoolClient,
  campaignId: string,
  templateIds: string[]
) {
  for (const templateId of templateIds) {
    const { rows: t } = await tx.query(
      `select trigger_kind from series_templates where id = $1`,
      [templateId]
    );
    let sessionId: string | null = null;
    if (t.length) {
      const { rows: s } = await tx.query(
        `select id from campaign_sessions
          where campaign_id = $1 and kind = $2
          order by sort_order limit 1`,
        [campaignId, t[0].trigger_kind]
      );
      sessionId = s[0]?.id ?? null;
    }
    const sort = await nextSort(tx, "campaign_series", "campaign_id", campaignId);
    await tx.query(
      `insert into campaign_series (campaign_id, series_template_id, trigger_session_id, sort_order)
       values ($1, $2, $3, $4) on conflict (campaign_id, series_template_id) do nothing`,
      [campaignId, templateId, sessionId, sort]
    );
  }
}

async function apply(tx: PoolClient, a: any): Promise<void> {
  switch (a.type) {
    // ——— clients ———
    case "addClient":
      await tx.query(
        `insert into clients (id, name, short_name, location, sector, status)
         values ($1, $2, $3, $4, $5, 'onboarding')`,
        [a.id, a.name, a.name.split(" ")[0], a.location || "—", a.sector || "—"]
      );
      return;
    case "removeClient":
      await tx.query(`delete from clients where id = $1`, [a.clientId]);
      return;
    case "updateClient":
      await patchRow(tx, "clients", a.clientId, a.patch, {
        name: "name",
        location: "location",
        sector: "sector",
        status: "status",
        phoenixLeaderId: "phoenix_leader_id",
        phoenixCoachId: "phoenix_coach_id",
        projectManagerId: "project_manager_id",
        spaceUrl: "space_url",
        inviteUrl: "invite_url",
      });
      return;
    case "addMember":
      await tx.query(
        `insert into members (id, client_id, name, title, email, role)
         values ($1, $2, $3, $4, $5, $6)`,
        [a.id, a.clientId, a.name, a.title || null, a.email, a.role]
      );
      return;
    case "removeMember":
      await tx.query(`delete from members where id = $1`, [a.memberId]);
      return;

    // ——— campaigns ———
    case "addCampaign": {
      await tx.query(
        `insert into campaigns (id, client_id, template_id, code, name, timezone)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          a.id,
          a.clientId,
          a.fromTemplateId ?? null,
          a.code || "TLE",
          a.name,
          a.timezone || "America/New_York",
        ]
      );
      const standard = [
        { kind: "orientation", name: "Orientation Session", mode: "virtual" },
        { kind: "workshop", name: "Workshop", mode: "in-person" },
        { kind: "coaching1", name: "Coaching Session 1 · Management", mode: "virtual" },
        { kind: "coaching2", name: "Coaching Session 2 · Coaching", mode: "in-person" },
        { kind: "launch", name: "Launch Session", mode: "virtual" },
      ];
      if (a.withStandardSessions) {
        for (let i = 0; i < standard.length; i++) {
          await tx.query(
            `insert into campaign_sessions (id, campaign_id, name, mode, kind, sort_order)
             values ($1, $2, $3, $4, $5, $6)`,
            [
              a.sessionIds?.[i] ?? null,
              a.id,
              standard[i].name,
              standard[i].mode,
              standard[i].kind,
              i,
            ]
          );
        }
      }
      await insertLoadedSeries(tx, a.id, a.templateIds ?? []);
      // a client with its first campaign moves out of onboarding
      await tx.query(
        `update clients set status = 'active' where id = $1 and status = 'onboarding'`,
        [a.clientId]
      );
      return;
    }
    case "removeCampaign":
      await tx.query(`delete from campaigns where id = $1`, [a.campaignId]);
      return;
    case "updateCampaign":
      await patchRow(tx, "campaigns", a.campaignId, a.patch, {
        name: "name",
        code: "code",
        timezone: "timezone",
        statusOverride: "status_override",
        startDate: "start_date",
        endDate: "end_date",
      });
      return;

    // ——— sessions ———
    case "addSession": {
      const sort = await nextSort(tx, "campaign_sessions", "campaign_id", a.campaignId);
      await tx.query(
        `insert into campaign_sessions (id, campaign_id, name, sort_order)
         values ($1, $2, $3, $4)`,
        [a.id, a.campaignId, a.name ?? `Session ${sort + 1}`, sort]
      );
      return;
    }
    case "removeSession":
      await tx.query(`delete from campaign_sessions where id = $1`, [a.sessionId]);
      return;
    case "updateSession":
      await patchRow(tx, "campaign_sessions", a.sessionId, a.patch, {
        name: "name",
        date: "session_date",
        mode: "mode",
      });
      return;
    case "moveSession":
      await reorder(
        tx, "campaign_sessions", "campaign_id", a.campaignId, "id",
        a.sessionId, null, a.dir
      );
      return;
    case "moveSessionTo":
      await reorder(
        tx, "campaign_sessions", "campaign_id", a.campaignId, "id",
        a.sessionId, a.toIndex, null
      );
      return;

    // ——— series loaded into a campaign ———
    case "loadSeries":
      await insertLoadedSeries(tx, a.campaignId, a.templateIds ?? []);
      return;
    case "unloadSeries":
      await tx.query(
        `delete from campaign_series where campaign_id = $1 and series_template_id = $2`,
        [a.campaignId, a.templateId]
      );
      return;
    case "bindSeries":
      await tx.query(
        `update campaign_series set trigger_session_id = $1
          where campaign_id = $2 and series_template_id = $3`,
        [a.sessionId, a.campaignId, a.templateId]
      );
      return;
    case "moveSeries":
      await reorder(
        tx, "campaign_series", "campaign_id", a.campaignId, "series_template_id",
        a.templateId, null, a.dir
      );
      return;
    case "moveSeriesTo":
      await reorder(
        tx, "campaign_series", "campaign_id", a.campaignId, "series_template_id",
        a.templateId, a.toIndex, null
      );
      return;

    // ——— campaign assignments ———
    case "addPhoenixAssignment":
      await tx.query(
        `insert into campaign_phoenix_assignments (id, campaign_id, staff_id, role)
         values ($1, $2, $3, $4)`,
        [a.id, a.campaignId, a.staffId, a.role]
      );
      return;
    case "updatePhoenixAssignment":
      await patchRow(tx, "campaign_phoenix_assignments", a.assignmentId, a.patch, {
        staffId: "staff_id",
        role: "role",
      });
      return;
    case "removePhoenixAssignment":
      await tx.query(`delete from campaign_phoenix_assignments where id = $1`, [
        a.assignmentId,
      ]);
      return;
    case "addClientAssignment":
      await tx.query(
        `insert into campaign_client_assignments (id, campaign_id, member_id, role)
         values ($1, $2, $3, $4)`,
        [a.id, a.campaignId, a.memberId, a.role]
      );
      return;
    case "updateClientAssignment":
      await patchRow(tx, "campaign_client_assignments", a.assignmentId, a.patch, {
        memberId: "member_id",
        role: "role",
      });
      return;
    case "removeClientAssignment":
      await tx.query(`delete from campaign_client_assignments where id = $1`, [
        a.assignmentId,
      ]);
      return;

    // ——— the Phoenix team ———
    case "addStaff": {
      const initials = String(a.name)
        .split(/\s+/)
        .filter(Boolean)
        .map((w: string) => w[0].toUpperCase())
        .slice(0, 2)
        .join("");
      await tx.query(
        `insert into staff (id, name, role_title, initials, email)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing`,
        [a.id, a.name, a.role ?? "", initials || "?", a.email]
      );
      return;
    }
    case "updateStaff":
      await patchRow(tx, "staff", a.staffId, a.patch, {
        name: "name",
        role: "role_title",
        email: "email",
      });
      return;
    case "removeStaff":
      // client defaults release automatically (on delete set null);
      // campaign assignments cascade
      await tx.query(`delete from staff where id = $1`, [a.staffId]);
      return;

    // ——— invitations ———
    case "addInvitation":
      await tx.query(
        `insert into invitations (id, email, role, client_id, staff_id)
         values ($1, $2, $3, $4, $5)`,
        [a.id, a.email, a.role, a.clientId ?? null, a.staffId ?? null]
      );
      return;
    case "removeInvitation":
      await tx.query(`delete from invitations where id = $1`, [a.invitationId]);
      return;

    // ——— series & lesson library ———
    case "updateStepMeta":
      await patchRow(tx, "series_steps", a.stepId, a.patch, {
        code: "code",
        title: "title",
        offsetDays: "offset_days",
        sendTime: "send_time",
      });
      return;
    case "updateStepContent": {
      const { rows } = await tx.query(
        `insert into step_contents (step_id, variant)
         values ($1, $2)
         on conflict (step_id, variant) do update set step_id = excluded.step_id
         returning id`,
        [a.stepId, a.variant]
      );
      const contentId = rows[0].id;
      const p = a.patch ?? {};
      const patch: Record<string, any> = { ...p };
      if ("lesson" in p) {
        patch.lessonLabel = p.lesson?.label ?? null;
        patch.lessonUrl = p.lesson?.url ?? null;
      }
      await patchRow(tx, "step_contents", contentId, patch, {
        emailSubject: "email_subject",
        emailBody: "email_body",
        lessonLabel: "lesson_label",
        lessonUrl: "lesson_url",
        teamMeeting: "team_meeting",
        note: "note",
      });
      if ("extras" in p) {
        await tx.query(`delete from step_links where step_content_id = $1`, [contentId]);
        const extras = p.extras ?? [];
        for (let i = 0; i < extras.length; i++) {
          await tx.query(
            `insert into step_links (step_content_id, label, url, sort_order)
             values ($1, $2, $3, $4)`,
            [contentId, extras[i].label, extras[i].url, i]
          );
        }
      }
      return;
    }
    case "removeSeries":
      await tx.query(`delete from series_templates where id = $1`, [a.templateId]);
      return;
    case "addStep": {
      const sort = await nextSort(tx, "series_steps", "series_template_id", a.templateId);
      const { rows: t } = await tx.query(
        `select code from series_templates where id = $1`,
        [a.templateId]
      );
      await tx.query(
        `insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order)
         values ($1, $2, $3, 'New lesson', 7, '08:00', $4)`,
        [a.id, a.templateId, `${t[0]?.code ?? "STEP"} ${sort + 1}`, sort]
      );
      for (const variant of ["participant", "leader"]) {
        await tx.query(
          `insert into step_contents (step_id, variant, email_subject, email_body, lesson_label)
           values ($1, $2, 'New lesson email subject',
                   'Write the email that goes with this lesson.', 'Lesson link')`,
          [a.id, variant]
        );
      }
      return;
    }
    case "removeStep":
      await tx.query(`delete from series_steps where id = $1`, [a.stepId]);
      return;
    case "moveStep":
      await reorder(
        tx, "series_steps", "series_template_id", a.templateId, "id",
        a.stepId, null, a.dir
      );
      return;
    case "addSeries": {
      const sort = await nextSort(
        tx, "series_templates", "campaign_template_id", a.campaignTemplateId
      );
      const ramp = ["#eb320f", "#cf3352", "#a1348c", "#6531a5", "#2c2d83"];
      await tx.query(
        `insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          a.id,
          a.campaignTemplateId,
          a.code.toUpperCase(),
          a.name,
          a.focus || "—",
          a.trigger,
          ramp[sort % ramp.length],
          sort,
        ]
      );
      return;
    }

    // ——— campaign blueprints ———
    case "addCampaignTemplate":
      await tx.query(
        `insert into campaign_templates (id, code, name, description)
         values ($1, $2, $3, $4)`,
        [a.id, a.code.toUpperCase(), a.name, a.description]
      );
      return;
    case "duplicateCampaignTemplate": {
      if (!a.plan) return; // nothing to mirror without the id plan
      const { rows: src } = await tx.query(
        `select code, name, description from campaign_templates where id = $1`,
        [a.templateId]
      );
      if (!src.length) return;
      await tx.query(
        `insert into campaign_templates (id, code, name, description)
         values ($1, $2, $3, $4)`,
        [a.plan.newId, `${src[0].code}-2`, `${src[0].name} (copy)`, src[0].description]
      );
      for (const s of a.plan.series) {
        await tx.query(
          `insert into series_templates
             (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order)
           select $1, $2, code, name, focus, trigger_kind, color, sort_order
             from series_templates where id = $3`,
          [s.newId, a.plan.newId, s.sourceId]
        );
        for (const st of s.steps) {
          await tx.query(
            `insert into series_steps
               (id, series_template_id, code, title, offset_days, send_time, sort_order)
             select $1, $2, code, title, offset_days, send_time, sort_order
               from series_steps where id = $3`,
            [st.newId, s.newId, st.sourceId]
          );
          const { rows: srcContents } = await tx.query(
            `select id, variant from step_contents where step_id = $1`,
            [st.sourceId]
          );
          for (const c of srcContents) {
            const { rows: inserted } = await tx.query(
              `insert into step_contents
                 (step_id, variant, email_subject, email_body, lesson_label,
                  lesson_url, team_meeting, note)
               select $1, variant, email_subject, email_body, lesson_label,
                      lesson_url, team_meeting, note
                 from step_contents where id = $2
               returning id`,
              [st.newId, c.id]
            );
            await tx.query(
              `insert into step_links (step_content_id, label, url, sort_order)
               select $1, label, url, sort_order from step_links
                where step_content_id = $2`,
              [inserted[0].id, c.id]
            );
          }
        }
      }
      return;
    }
    case "removeCampaignTemplate":
      await tx.query(`delete from campaign_templates where id = $1`, [a.templateId]);
      return;
    case "updateCampaignTemplate":
      await patchRow(tx, "campaign_templates", a.templateId, a.patch, {
        name: "name",
        code: "code",
        description: "description",
      });
      return;

    default:
      throw new Error(`unknown action type: ${a.type}`);
  }
}

export async function POST(req: Request) {
  if (!dbConfigured)
    return NextResponse.json({ error: "database not configured" }, { status: 503 });

  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ error: "sign in first" }, { status: who.status });

  let action: any;
  try {
    action = (await req.json()).action;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!action?.type)
    return NextResponse.json({ error: "missing action" }, { status: 400 });

  if (authEnforced && who.userId) {
    const profile = await getProfile(getPool(), who.userId);
    if (!(await actionAllowed(getPool(), profile, action)))
      return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await apply(client, action);
    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("rollback").catch(() => {});
    console.error(`POST /api/action ${action.type} failed:`, err);
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  } finally {
    client.release();
  }
}
