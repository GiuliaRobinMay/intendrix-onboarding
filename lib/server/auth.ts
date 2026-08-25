// Server-side auth for the app's own API routes. Enforcement switches on
// only when the Supabase keys are configured; until then the routes stay
// open, matching the prototype.

import { createClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const authEnforced = Boolean(url && anonKey);

export interface Verified {
  ok: boolean;
  status?: number;
  userId?: string;
}

/** Validate the caller's Supabase session token. Open mode: always ok. */
export async function verifyUser(req: Request): Promise<Verified> {
  if (!authEnforced) return { ok: true };
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { ok: false, status: 401 };
  try {
    const supabase = createClient(url!, anonKey!);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return { ok: false, status: 401 };
    return { ok: true, userId: data.user.id };
  } catch {
    return { ok: false, status: 401 };
  }
}

export interface Profile {
  role: "phoenix_admin" | "client_admin" | null;
  clientId: string | null;
}

/** The signed-in user's role and scope, provisioned by the database when
 *  they accepted their invitation. */
export async function getProfile(pool: Pool, userId: string): Promise<Profile> {
  const { rows } = await pool.query(
    `select role, client_id from profiles where id = $1`,
    [userId]
  );
  if (!rows.length) return { role: null, clientId: null };
  return { role: rows[0].role, clientId: rows[0].client_id };
}

/** Campaign-scoped actions a client admin may run on their own company. */
const CLIENT_ADMIN_ACTIONS = new Set([
  "updateCampaign",
  "addSession",
  "removeSession",
  "updateSession",
  "moveSession",
  "moveSessionTo",
  "loadSeries",
  "unloadSeries",
  "bindSeries",
  "moveSeries",
  "moveSeriesTo",
  "addPhoenixAssignment",
  "updatePhoenixAssignment",
  "removePhoenixAssignment",
  "addClientAssignment",
  "updateClientAssignment",
  "removeClientAssignment",
]);

/* eslint-disable @typescript-eslint/no-explicit-any */

/** May this profile run this action? Phoenix admins: everything. Client
 *  admins: run-access on their own company's campaigns only. */
export async function actionAllowed(
  pool: Pool,
  profile: Profile,
  action: any
): Promise<boolean> {
  if (profile.role === "phoenix_admin") return true;
  if (profile.role !== "client_admin" || !profile.clientId) return false;
  if (!CLIENT_ADMIN_ACTIONS.has(action.type)) return false;
  if (action.clientId && action.clientId !== profile.clientId) return false;
  if (action.campaignId) {
    const { rows } = await pool.query(
      `select 1 from campaigns where id = $1 and client_id = $2`,
      [action.campaignId, profile.clientId]
    );
    if (!rows.length) return false;
  }
  return true;
}
