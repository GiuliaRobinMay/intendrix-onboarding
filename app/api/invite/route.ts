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
  let email: string;
  try {
    email = (await req.json()).email;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!email || !email.includes("@"))
    return NextResponse.json({ error: "invalid email" }, { status: 400 });

  // Two ways to be allowed here:
  //  * a signed-in Phoenix admin inviting anyone (the normal flow), or
  //  * anyone activating an invitation that already exists for exactly
  //    this address — the email only ever goes to the invited inbox, so
  //    this is the same shape as "forgot password" and it means the
  //    very first account never needs the Supabase dashboard.
  const who = await verifyUser(req);
  let allowed = false;

  if (who.ok && who.userId && dbConfigured) {
    const profile = await getProfile(getPool(), who.userId);
    allowed = profile.role === "phoenix_admin";
  } else if (who.ok && !authEnforced) {
    allowed = true; // open mode: no sign-in configured yet
  }

  if (!allowed && dbConfigured) {
    const { rows } = await getPool().query(
      `select 1 from invitations
        where lower(email) = lower($1) and accepted_at is null limit 1`,
      [email]
    );
    allowed = rows.length > 0;
  }

  if (!allowed)
    return NextResponse.json(
      { sent: false, reason: "no invitation for this address" },
      { status: 403 }
    );

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
      // The account already exists (e.g. activating a second time). Send a
      // set-your-password email instead, which lands on the same screen.
      if (/already/i.test(error.message)) {
        const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
        const { error: resetError } = await anon.auth.resetPasswordForEmail(email, {
          redirectTo: origin,
        });
        return NextResponse.json(
          resetError
            ? { sent: false, reason: "this address already has an account" }
            : { sent: true, note: "password-set email sent" }
        );
      }
      return NextResponse.json({ sent: false, reason: error.message }, { status: 502 });
    }
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json(
      { sent: false, reason: "could not reach Supabase" },
      { status: 502 }
    );
  }
}
