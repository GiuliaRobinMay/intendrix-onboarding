// Outgoing email via Resend's HTTP API. Activates when RESEND_API_KEY is
// set; without it the engine reports what it would send and touches
// nothing. The from-address is the responsible's own address (the Coach),
// which requires the sending domain to be verified with the provider.

export { personalize, MERGE_FIELDS, type MergeValues } from "../merge";

const apiKey = process.env.RESEND_API_KEY;

export const emailConfigured = Boolean(apiKey);

export interface OutgoingEmail {
  from: string; // "Name <person@intendrix.ai>"
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
}

export async function sendEmail(
  mail: OutgoingEmail
): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey) return { ok: false, error: "email sending not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        reply_to: mail.replyTo,
        subject: mail.subject,
        html: mail.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `provider ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `provider unreachable: ${String(err).slice(0, 150)}` };
  }
}

interface LessonLinkLike {
  label: string;
  url: string | null;
}

/** The lesson email itself — simple, text-first, one clear button. */
export function renderLessonEmail(opts: {
  body: string;
  lesson?: LessonLinkLike | null;
  extras?: LessonLinkLike[];
  teamMeeting?: string | null;
  senderName: string;
  /** the sender's role, used when they have no signature of their own */
  senderRole?: string | null;
  /** exact sign-off block, one line per line */
  signature?: string | null;
  /** marks a test send, so nobody mistakes one for the real thing */
  test?: boolean;
  /** company logo shown under the sign-off — a public image URL */
  logoUrl?: string | null;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1b2e;">${esc(p).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
  const button = opts.lesson?.url
    ? `<p style="margin:22px 0;"><a href="${opts.lesson.url}" style="background:#2c2d83;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:6px;display:inline-block;">${esc(opts.lesson.label || "Open the lesson")}</a></p>`
    : "";
  const extras = (opts.extras ?? [])
    .filter((x) => x.url)
    .map(
      (x) =>
        `<p style="margin:0 0 6px;font-size:13px;"><a href="${x.url}" style="color:#2c2d83;">${esc(x.label)}</a></p>`
    )
    .join("");
  const meeting = opts.teamMeeting
    ? `<p style="margin:18px 0;padding:10px 14px;background:#fdf6e3;border-radius:6px;font-size:13px;color:#8a6d1a;"><strong>Team meeting:</strong> ${esc(opts.teamMeeting)}</p>`
    : "";
  // the sign-off: their own signature if they have written one, else
  // their name and role
  const signOff = (
    opts.signature?.trim()
      ? opts.signature.trim()
      : [opts.senderName, opts.senderRole].filter(Boolean).join("\n")
  )
    .split("\n")
    .map((line, i) =>
      i === 0
        ? `<p style="margin:0;font-size:13px;font-weight:600;color:#1a1b2e;">${esc(line)}</p>`
        : `<p style="margin:0;font-size:12px;color:#5f6170;">${esc(line)}</p>`
    )
    .join("");
  const logo =
    opts.logoUrl && /^https:\/\//.test(opts.logoUrl)
      ? `<img src="${opts.logoUrl}" alt="" style="display:block;margin:14px 0 0;max-height:44px;max-width:200px;" />`
      : "";
  const banner = opts.test
    ? `<p style="margin:0 0 18px;padding:9px 13px;background:#fde8e2;border-radius:6px;font-size:12px;font-weight:600;color:#a52a0c;">TEST — this is a preview. Nobody on the programme received it.</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f6;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="background:#ffffff;border:1px solid #e4e4e8;border-radius:8px;padding:28px;">
    ${banner}${paragraphs}${button}${extras}${meeting}
    <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #ececf0;">${signOff}${logo}</div>
  </div>
  <p style="margin:14px 4px 0;font-size:11px;color:#9a9ca6;">Sent by Intendrix for your leadership programme.</p>
</div>
</body></html>`;
}
