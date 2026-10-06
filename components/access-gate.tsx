"use client";

// A signed-in account the server refused sees this, and nothing else.
//
// It used to see the app, filled with the built-in demo clients —
// indistinguishable from real ones. Three people worked that way for
// weeks and reported a missing client rather than a missing account.
// So a refusal is now a wall, not a quieter version of the app: no
// sidebar, no pages, no data that could be mistaken for theirs.

import { Lock } from "lucide-react";
import { useData } from "@/lib/state";
import { getSupabase, authConfigured } from "@/lib/supabase-browser";

export function AccessGate({ children }: { children: React.ReactNode }) {
  const { backend, accessError } = useData();
  if (backend !== "denied") return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="card w-full max-w-lg p-7">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#eb320f]/15">
            <Lock size={17} className="text-[#ff7a55]" />
          </span>
          <h1 className="text-lg font-bold">This account has no access yet</h1>
        </div>

        <p className="text-sm leading-relaxed text-mist">
          You are signed in, but Intendrix has not been told who you are, so it
          will not show you anything — not even a sample, because sample data
          looks exactly like the real thing.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          Ask whoever runs Intendrix to invite this address. If you were invited
          already, it was probably sent after you created your account, which
          used to leave it unused.
        </p>

        {accessError && (
          <p className="mt-4 rounded-md border border-white/10 bg-navy/50 px-3 py-2 font-mono text-[11px] text-paper">
            {accessError}
          </p>
        )}

        {authConfigured && (
          <button
            onClick={() => getSupabase().auth.signOut()}
            className="mt-5 cursor-pointer rounded-md border border-white/12 px-3 py-1.5 text-xs font-semibold text-paper transition-colors hover:border-white/30"
          >
            Sign out and try another address
          </button>
        )}
      </div>
    </div>
  );
}
