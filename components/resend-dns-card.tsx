"use client";

// The sending domain at Resend, from Settings.
//
// Opens and clicks exist only when Resend's open and click tracking are
// switched on for the domain, and branded links only once the links
// record is verified. Resend stops checking a record after 72 hours and
// the dashboard has no "check again" — the API does. So: the records
// and their status, a button that asks for a new check, and one that
// turns tracking on.

import { useEffect, useState } from "react";
import { Check, Mail, RefreshCw, TriangleAlert, X } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { GhostButton, GradientButton } from "@/components/ui";

interface Hook {
  id: string;
  endpoint: string;
  status: string;
  events: string[];
  ours: boolean;
  missing: string[];
}

interface Domain {
  name: string;
  status: string;
  openTracking: boolean;
  clickTracking: boolean;
  records: Array<{ record: string; type: string; name: string; value: string; status: string }>;
}

const good = (s: string) => /verified|success/i.test(s);

export function ResendDnsCard() {
  const [domain, setDomain] = useState<Domain | null>(null);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [hooksReason, setHooksReason] = useState<string | null>(null);
  const [secretSet, setSecretSet] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (action: "status" | "verify" | "tracking" | "events") => {
    setBusy(action);
    try {
      const res = await fetch("/api/resend-verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action }),
      });
      const out = await res.json();
      if (out.ok) {
        setDomain(out.domain);
        setHooks(out.webhooks ?? []);
        setHooksReason(out.webhooksReason ?? null);
        setSecretSet(out.secretSet ?? null);
        setNotes(out.notes ?? []);
        setReason(null);
      } else setReason(out.reason ?? "could not reach Resend");
    } catch {
      setReason("could not reach the server");
    } finally {
      setBusy(null);
    }
  };
  useEffect(() => {
    call("status");
  }, []);

  const flag = (on: boolean, label: string) => (
    <span className={`flex items-center gap-1.5 text-xs font-semibold ${on ? "text-[#4ade80]" : "text-[#ff7a55]"}`}>
      {on ? <Check size={13} /> : <X size={13} />} {label} {on ? "on" : "off"}
    </span>
  );

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Mail size={17} className="text-mist" />
        Email tracking at Resend
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-mist">
        Opens and clicks are only recorded when Resend's tracking is on for the sending domain,
        and branded links only once the <code>links</code> record is verified. Resend stops
        checking a record after three days; the button asks it to look again.
      </p>

      {reason ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#ff7a55]">
          <TriangleAlert size={12} /> {reason}
        </p>
      ) : domain ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="text-xs">
              <span className="font-semibold">{domain.name}</span>{" "}
              <span className={good(domain.status) ? "text-[#4ade80]" : "text-[#facc15]"}>
                {domain.status.replace(/_/g, " ")}
              </span>
            </span>
            {flag(domain.openTracking, "Open tracking")}
            {flag(domain.clickTracking, "Click tracking")}
          </div>

          <table className="mt-3 w-full text-left text-[11px]">
            <thead className="text-mist">
              <tr>
                <th className="py-1 pr-3 font-semibold">For</th>
                <th className="py-1 pr-3 font-semibold">Type</th>
                <th className="py-1 pr-3 font-semibold">Name</th>
                <th className="py-1 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {domain.records.map((r, i) => (
                <tr key={i}>
                  <td className="py-1 pr-3 text-mist">{r.record}</td>
                  <td className="py-1 pr-3 font-mono">{r.type}</td>
                  <td className="py-1 pr-3 font-mono">{r.name}</td>
                  <td className={`py-1 font-semibold ${good(r.status) ? "text-[#4ade80]" : "text-[#ff7a55]"}`}>
                    {r.status.replace(/_/g, " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="mt-3 text-[11px] text-mist">Reading Resend…</p>
      )}

      {domain && (
        <div className="mt-4 border-t border-white/8 pt-3">
          <p className="text-xs font-semibold">Webhook — how Resend tells the app what became of an email</p>
          {hooksReason ? (
            <p className="mt-1 text-[11px] text-[#ff7a55]">{hooksReason}</p>
          ) : hooks.length === 0 ? (
            <p className="mt-1 text-[11px] text-[#ff7a55]">
              No webhook at Resend — without one, nothing delivered, opened or clicked ever reaches the app.
            </p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-[11px]">
              {hooks.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="font-mono text-mist">{h.endpoint}</span>
                  {h.ours && <span className="rounded bg-white/8 px-1.5 text-[10px] font-bold text-mist">THIS APP</span>}
                  <span className={h.status === "enabled" ? "text-[#4ade80]" : "text-[#ff7a55]"}>{h.status}</span>
                  {h.ours &&
                    (h.missing.length ? (
                      <span className="text-[#ff7a55]">not hearing: {h.missing.map((e) => e.replace("email.", "")).join(", ")}</span>
                    ) : (
                      <span className="text-[#4ade80]">hears delivered, opened, clicked, bounced, complained</span>
                    ))}
                </li>
              ))}
            </ul>
          )}
          {secretSet === false && (
            <p className="mt-1 text-[11px] text-[#ff7a55]">
              RESEND_WEBHOOK_SECRET is not set in Vercel — the app refuses every report until it is.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <GhostButton onClick={() => call("verify")} tip="Ask Resend to check the DNS records again now">
          <span className="flex items-center gap-1.5">
            <RefreshCw size={13} className={busy === "verify" ? "animate-spin" : ""} />
            {busy === "verify" ? "Checking…" : "Check the records again"}
          </span>
        </GhostButton>
        {domain && !(domain.openTracking && domain.clickTracking) && (
          <GradientButton onClick={() => call("tracking")} disabled={busy !== null}>
            {busy === "tracking" ? "Switching on…" : "Turn on open and click tracking"}
          </GradientButton>
        )}
        {hooks.some((h) => h.ours && h.missing.length > 0) && (
          <GradientButton onClick={() => call("events")} disabled={busy !== null}>
            {busy === "events" ? "Adding…" : "Make the webhook hear opens and clicks"}
          </GradientButton>
        )}
      </div>
      {notes.length > 0 && (
        <p className="mt-2 text-[11px] text-mist">{notes.join(" · ")}</p>
      )}
    </section>
  );
}
