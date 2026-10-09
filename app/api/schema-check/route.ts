// GET /api/schema-check — what the code needs that the database has
// not got yet. Hand-run migrations mean the two can drift; this is how
// the app notices before something breaks rather than after.

import { NextResponse } from "next/server";
import { dbConfigured, getPool } from "@/lib/server/db";
import { authEnforced, getProfile, verifyUser } from "@/lib/server/auth";
import { checkSchema } from "@/lib/server/schema-check";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!dbConfigured) return NextResponse.json({ ok: true, missing: [], sql: "" });
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ error: "sign in first" }, { status: who.status });
  const pool = getPool();
  if (who.userId) {
    const profile = await getProfile(pool, who.userId).catch(() => null);
    if (profile?.role !== "phoenix_admin")
      return NextResponse.json({ error: "Phoenix admins only" }, { status: 403 });
  } else if (authEnforced) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }
  return NextResponse.json(await checkSchema(pool));
}
