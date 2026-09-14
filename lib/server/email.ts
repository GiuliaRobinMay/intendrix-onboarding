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
  /** files the provider fetches and attaches — direct https links only */
  attachments?: Array<{ filename: string; path: string }>;
}

export async function sendEmail(
  mail: OutgoingEmail
): Promise<{ ok: boolean; id?: string; error?: string }> {
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
        ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `provider ${res.status}: ${body.slice(0, 200)}` };
    }
    // the provider's id for this email — the key that delivery webhooks
    // (delivered / opened / clicked / bounced) use to find the row again
    const id = await res
      .json()
      .then((j: { id?: string }) => j?.id)
      .catch(() => undefined);
    return { ok: true, ...(id ? { id } : {}) };
  } catch (err) {
    return { ok: false, error: `provider unreachable: ${String(err).slice(0, 150)}` };
  }
}

interface LessonLinkLike {
  label: string;
  url: string | null;
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TEST_BANNER = `<p style="margin:0 0 18px;padding:9px 13px;background:#fde8e2;border-radius:6px;font-size:12px;font-weight:600;color:#a52a0c;">TEST — this is a preview. Nobody on the programme received it.</p>`;

/** shared shell for the onboarding emails — same look as the lessons */
function renderShell(inner: string, signOffBlock: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f6;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="background:#ffffff;border:1px solid #e4e4e8;border-radius:8px;padding:28px;">
    ${inner}
    <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #ececf0;">${signOffBlock}</div>
  </div>
  <p style="margin:14px 4px 0;font-size:11px;color:#9a9ca6;">Sent by Intendrix for your leadership programme.</p>
</div>
</body></html>`;
}

function renderSignOff(opts: {
  senderName: string;
  senderRole?: string | null;
  signature?: string | null;
  logoUrl?: string | null;
}): string {
  const signOff = (
    opts.signature?.trim()
      ? opts.signature.trim()
      : [opts.senderName, opts.senderRole].filter(Boolean).join("\n")
  )
    .split("\n")
    .map((line, i) =>
      i === 0
        ? `<p style="margin:0;font-size:13px;font-weight:600;color:#1a1b2e;">${escHtml(line)}</p>`
        : `<p style="margin:0;font-size:12px;color:#5f6170;">${escHtml(line)}</p>`
    )
    .join("");
  const logo =
    opts.logoUrl && /^https:\/\//.test(opts.logoUrl)
      ? `<img src="${opts.logoUrl}" alt="" style="display:block;margin:14px 0 0;max-height:44px;max-width:200px;" />`
      : "";
  return signOff + logo;
}

const P = (text: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1b2e;">${text}</p>`;
const BUTTON = (url: string, label: string) =>
  `<p style="margin:22px 0;"><a href="${url}" style="background:#2c2d83;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;display:inline-block;">${escHtml(label)}</a></p>`;

/** The user-agreement email: a short, human summary and one button to
 *  the personal accept page. The full text lives on that page, where
 *  the click is recorded — never as an attachment. */
export function renderAgreementEmail(opts: {
  firstName: string;
  clientName: string;
  agreeUrl: string;
  thenCommunity: boolean;
  senderName: string;
  senderRole?: string | null;
  signature?: string | null;
  logoUrl?: string | null;
  /** marks a test send, so nobody mistakes one for the real thing */
  test?: boolean;
}): string {
  const inner = [
    opts.test ? TEST_BANNER : "",
    P(`Hi ${escHtml(opts.firstName)},`),
    P(
      `Welcome to Intendrix. Before your ${escHtml(opts.clientName)} programme opens up, there is one short piece of paperwork: the Intendrix user agreement. In plain words, it says three things:`
    ),
    `<ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.6;color:#1a1b2e;">
      <li style="margin-bottom:6px;">It is your personal license to use Intendrix and the coaching delivered through it.</li>
      <li style="margin-bottom:6px;">Coaching is personal development — not therapy or medical, legal or financial advice. Your choices stay your own.</li>
      <li>You own what you write; Phoenix Performance Partners owns the platform and the lesson content.</li>
    </ul>`,
    P(`The button below opens the full agreement, personal to you. Reading it takes about three minutes, and accepting it is one click.`),
    BUTTON(opts.agreeUrl, "Review & accept the agreement"),
    opts.thenCommunity
      ? P(`Right after you accept, you will get your personal link to join the ${escHtml(opts.clientName)} community — that is where your programme lives.`)
      : "",
  ]
    .filter(Boolean)
    .join("");
  return renderShell(inner, renderSignOff(opts));
}

/** The community invitation, shaped by SOP-03: the plan link as the only
 *  link in the message, the account-creation steps spelled out (wording
 *  from the member guide, which travels along as the attachment), where
 *  they arrive, and a person to reply to. */
export function renderInviteEmail(opts: {
  firstName: string;
  clientName: string;
  inviteUrl: string;
  senderName: string;
  senderRole?: string | null;
  signature?: string | null;
  logoUrl?: string | null;
  /** marks a test send, so nobody mistakes one for the real thing */
  test?: boolean;
}): string {
  const li = (t: string) => `<li style="margin-bottom:8px;">${t}</li>`;
  const inner = [
    opts.test ? TEST_BANNER : "",
    P(`Hi ${escHtml(opts.firstName)},`),
    P(
      `You're invited into ${escHtml(opts.clientName)}'s space on Intendrix — the home for your team's work together. Getting in takes about three minutes, and you only do it once:`
    ),
    `<ol style="margin:0 0 14px;padding-left:22px;font-size:14px;line-height:1.6;color:#1a1b2e;">` +
      li(
        `Click the button below. It opens your team's welcome page, with ${escHtml(opts.clientName)}'s name on it.`
      ) +
      li(`On that page, click the red <strong>Access</strong> button.`) +
      li(
        `Create your account: your name, your <strong>work email</strong>, and a password you'll remember — or use the Google, LinkedIn, Facebook or Apple button instead.`
      ) +
      li(
        `Tick the first box (the terms of use) and click <strong>Confirm</strong>. Add a photo, or skip it for now.`
      ) +
      li(
        `You'll arrive in <strong>A Warm Welcome</strong>. Your team's own space is in the left sidebar, under <strong>TEAM CONNECT</strong>.`
      ) +
      `</ol>`,
    BUTTON(opts.inviteUrl, "Open your invitation"),
    P(
      `The attached guide, <em>Welcome to Intendrix</em>, walks through the same steps with screenshots — and shows how to put Intendrix on your phone.`
    ),
    P(
      `If anything doesn't work, just reply to this email — a real person reads it. Welcome aboard.`
    ),
  ]
    .filter(Boolean)
    .join("");
  return renderShell(inner, renderSignOff(opts));
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
