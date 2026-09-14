// Shared plumbing for the onboarding sends (user agreement, community
// invitation): who a campaign's emails come from, and the paced sender.

import type { Pool } from "pg";
import { sendEmail } from "@/lib/server/email";
import { FALLBACK_SENDING_ADDRESS as DEFAULT_SENDING_ADDRESS } from "@/lib/store";

const SENDING_ADDRESS = process.env.SENDING_ADDRESS || DEFAULT_SENDING_ADDRESS;

/** The new-member guide that travels with every community invitation
 *  ("Welcome to Intendrix — How to Join"). The provider fetches it from
 *  this public link at send time; the app_settings key newMemberGuideUrl
 *  overrides it if the file ever moves. */
const NEW_MEMBER_GUIDE_URL =
  "https://drive.usercontent.google.com/download?id=13NNPsy_BdyrcszKI1fKRM9uKVu0fgG3B&export=download";
export const NEW_MEMBER_GUIDE_FILENAME = "Welcome to Intendrix - How to Join.pdf";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CampaignContext {
  campaign: any;
  from: {
    name: string;
    address: string;
    replyTo: string;
    role: string | null;
    signature: string | null;
  };
  senderStaffId: string | null;
  logoUrl: string | null;
  guideUrl: string;
}

/** The campaign with its client, and the sender its emails go out as —
 *  the same resolution the engine uses. */
export async function campaignContext(
  pool: Pool,
  campaignId: string
): Promise<CampaignContext | { error: string }> {
  const { rows: campaignRows } = await pool.query(
    `select c.id, c.code, c.name, c.status_override, c.sender_member_id,
            cl.id as client_id, cl.name as client_name,
            cl.short_name as client_short_name, cl.invite_url,
            cl.phoenix_leader_id, cl.phoenix_coach_id, cl.project_manager_id
       from campaigns c join clients cl on cl.id = c.client_id
      where c.id = $1`,
    [campaignId]
  );
  const campaign = campaignRows[0];
  if (!campaign) return { error: "that campaign no longer exists" };

  const { rows: assignments } = await pool.query(
    `select staff_id, role from campaign_phoenix_assignments
      where campaign_id = $1 order by created_at`,
    [campaignId]
  );
  const pick = (role: string, fallback: string | null) =>
    assignments.find((a: any) => a.role === role)?.staff_id ?? fallback;
  const staffId =
    pick("phoenix_coach", campaign.phoenix_coach_id) ??
    pick("phoenix_leader", campaign.phoenix_leader_id) ??
    pick("project_manager", campaign.project_manager_id);

  let from: CampaignContext["from"] | null = null;
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
    return { error: "this campaign has no sender yet — assign a Phoenix Coach first" };

  const settings = await pool
    .query(
      `select key, value from app_settings
        where key in ('signatureLogoUrl', 'newMemberGuideUrl')`
    )
    .then((r) => new Map(r.rows.map((x: any) => [x.key, x.value])))
    .catch(() => new Map());
  const logoUrl = settings.get("signatureLogoUrl") ?? null;
  const guideUrl = settings.get("newMemberGuideUrl") || NEW_MEMBER_GUIDE_URL;

  return { campaign, from, senderStaffId, logoUrl, guideUrl };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ~2 requests/second keeps the provider happy; a rate-limited send
 *  gets one second chance. */
export async function sendPaced(
  mail: Parameters<typeof sendEmail>[0]
): Promise<Awaited<ReturnType<typeof sendEmail>>> {
  let result = await sendEmail(mail);
  if (!result.ok && /429|rate_limit/i.test(result.error ?? "")) {
    await sleep(1600);
    result = await sendEmail(mail);
  }
  await sleep(550);
  return result;
}

export const firstNameOf = (m: any): string =>
  m.first_name || String(m.name ?? "").trim().split(/\s+/)[0] || "there";
