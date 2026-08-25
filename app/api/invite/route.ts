// POST /api/invite — sends the real invitation email through Supabase
// (the invitations row itself is written by the normal action flow).
// Requires the service-role key; without it the invite is recorded but
// no email goes out, and the caller is told so.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ error: "sign in first" }, { status: who.status });
  if (authEnforced && dbConfigured && who.userId) {
    const profile = await getProfile(getPool(), who.userId);
    if (profile.role !== "phoenix_admin")
      return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }

  let email: string;
  try {
    email = (await req.json()).email;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!email || !email.includes("@"))
    return NextResponse.json({ error: "invalid email" }, { status: 400 });

  if (!url || !serviceKey) {
    return NextResponse.json({ sent: false, reason: "email sending not configured" });
  }

  try {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const origin = new URL(req.url).origin;
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin,
    });
    if (error) {
      // already registered → they can just sign in; anything else is real
      const benign = /already/i.test(error.message);
      return NextResponse.json(
        benign
          ? { sent: false, reason: "this person already has an account" }
          : { sent: false, reason: error.message },
        { status: benign ? 200 : 502 }
      );
    }
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json(
      { sent: false, reason: "could not reach Supabase" },
      { status: 502 }
    );
  }
}
