// What happened to one email, in one word.
//
// Two facts decide it: what our own send log recorded (scheduled, sent,
// failed, held) and what the provider reported afterwards (delivered,
// opened, clicked, bounced, complained). The provider only has an
// opinion once we actually handed the email over, so a row that says
// "sent" defers to the provider and everything else speaks for itself.
//
// One table, used everywhere an email's state is shown, because the
// same email described two ways in two places is how you end up
// arguing with a client about whether it arrived.

export interface EmailState {
  text: string;
  color: string;
  tip: string;
}

export const EMAIL_STATE: Record<string, EmailState> = {
  clicked: {
    text: "clicked",
    color: "var(--tone-green)",
    tip: "Delivered, opened, and a link was clicked",
  },
  opened: { text: "opened", color: "var(--tone-green)", tip: "Delivered and opened" },
  delivered: {
    text: "delivered",
    color: "var(--color-mist)",
    tip: "Accepted by their mail server — no sign of it being opened yet",
  },
  delivery_delayed: {
    text: "delayed",
    color: "var(--tone-yellow)",
    tip: "Their mail server is holding it — usually it still arrives",
  },
  bounced: {
    text: "bounced",
    color: "#ff7a55",
    tip: "Refused by their mail server — the address is wrong or closed",
  },
  complained: {
    text: "marked as spam",
    color: "#ff7a55",
    tip: "They reported it as spam — stop sending to this address",
  },
  failed: { text: "failed", color: "#ff7a55", tip: "It never left — see the reason" },
  held: { text: "held", color: "var(--tone-yellow)", tip: "Waiting, not sent yet" },
  scheduled: { text: "scheduled", color: "var(--color-mist)", tip: "Still ahead" },
  sent: {
    text: "sent",
    color: "var(--color-mist)",
    tip: "Handed to the provider — no delivery report yet",
  },
};

export function emailState(r: {
  status: string;
  event?: string | null;
  error?: string | null;
}): EmailState {
  if (r.status === "sent") return EMAIL_STATE[r.event ?? "sent"] ?? EMAIL_STATE.sent;
  return (
    EMAIL_STATE[r.status] ?? {
      text: r.status,
      color: "#ff7a55",
      tip: r.error ?? r.status,
    }
  );
}

/** Did this one go wrong — refused, bounced, or reported as spam? */
export const emailTroubled = (r: { status: string; event?: string | null }) =>
  r.status === "failed" ||
  ["bounced", "complained", "failed"].includes(r.event ?? "");
