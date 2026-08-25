"use client";

// Wraps the whole app. Without the Supabase keys it renders straight
// through (open prototype). With them, nobody sees the portal without
// signing in; people arriving from an invitation email set their own
// password first (Brad's model: email address + own password).

import { useEffect, useState, type ReactNode } from "react";
import { KeyRound, LogIn } from "lucide-react";
import { authConfigured, getSupabase } from "@/lib/supabase-browser";

type Gate = "loading" | "open" | "login" | "setPassword" | "ready";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="card w-full max-w-sm p-8">
        <p className="brand-gradient-text text-xl font-bold tracking-tight">
          Intendrix
        </p>
        <p className="mt-0.5 text-xs text-mist">Team backend</p>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-white/10 bg-navy/60 px-2.5 py-2 text-sm focus:border-white/30 focus:outline-none";

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    if (!email || !password || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    // success flips the gate via onAuthStateChange
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "That email and password don't match."
          : "Could not sign in — check your connection and try again."
      );
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="mt-6 text-base font-bold">Sign in</h1>
      <p className="mt-1 text-xs leading-relaxed text-mist">
        Access is by invitation — if you were invited, use the link in your
        email first to set your password.
      </p>
      <form
        className="mt-5 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          signIn();
        }}
      >
        <label className="block">
          <span className="text-[11px] font-medium text-mist">Email address</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-mist">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className={inputCls}
          />
        </label>
        {error && <p className="text-xs font-semibold text-[#ff7a55]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="brand-gradient mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <LogIn size={14} /> {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Shell>
  );
}

function SetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      setError("Could not save the password — try again.");
      setBusy(false);
      return;
    }
    onDone();
  };

  return (
    <Shell>
      <h1 className="mt-6 text-base font-bold">Welcome — choose your password</h1>
      <p className="mt-1 text-xs leading-relaxed text-mist">
        You'll sign in with your email address and this password from now on.
      </p>
      <form
        className="mt-5 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="block">
          <span className="text-[11px] font-medium text-mist">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-mist">Repeat it</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Same password again"
            className={inputCls}
          />
        </label>
        {error && <p className="text-xs font-semibold text-[#ff7a55]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="brand-gradient mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <KeyRound size={14} /> {busy ? "Saving…" : "Save and enter"}
        </button>
      </form>
    </Shell>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>(authConfigured ? "loading" : "open");

  useEffect(() => {
    if (!authConfigured) return;
    const supabase = getSupabase();
    // an invitation / recovery link lands with a token in the URL hash
    const invited =
      typeof window !== "undefined" &&
      (window.location.hash.includes("type=invite") ||
        window.location.hash.includes("type=recovery"));

    supabase.auth.getSession().then(({ data }) => {
      setGate((g) => {
        if (g === "setPassword") return g;
        if (data.session) return invited ? "setPassword" : "ready";
        return invited ? "loading" : "login";
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setGate("setPassword");
      else if (session)
        setGate((g) => (g === "setPassword" ? g : invited ? "setPassword" : "ready"));
      else setGate("login");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (gate === "open" || gate === "ready") return <>{children}</>;
  if (gate === "login") return <LoginScreen />;
  if (gate === "setPassword")
    return <SetPasswordScreen onDone={() => setGate("ready")} />;
  return null; // loading — a blank beat before the gate decides
}
