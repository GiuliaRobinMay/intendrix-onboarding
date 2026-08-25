// Browser-side Supabase client, used only for sign-in. It activates when
// the two public keys are present at build time; without them the app
// runs open (no login), exactly as before.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const authConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) throw new Error("Supabase auth is not configured");
    client = createClient(url, anonKey);
  }
  return client;
}

/** Authorization header for the app's own API when signed in. */
export async function authHeaders(): Promise<Record<string, string>> {
  if (!authConfigured) return {};
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
