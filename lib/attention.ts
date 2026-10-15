// Everything that is waiting on a person.
//
// The dashboard used to count things: active clients, campaigns,
// lessons in the library. All true, none of it answerable — you cannot
// act on "12 campaigns". What costs this team weeks is the opposite
// shape: one address that bounced, one session nobody dated, one
// campaign with nobody to send from, sitting quietly inside a page
// nobody opens twice.
//
// So the dashboard asks one question now: what needs me today? Every
// row here is something a person can fix, and carries the link to the
// place they fix it.

import {
  campaignStatus,
  effectiveRole,
  emailSenderFor,
  mailboxItems,
  findStaff,
} from "./store";
import type { Client, SeriesTemplate, StaffMember } from "./types";

export type Urgency = "now" | "soon";

export interface AttentionItem {
  id: string;
  /** which group it belongs under */
  kind: "email" | "address" | "sender" | "session" | "client";
  urgency: Urgency;
  /** what is wrong, in a few words */
  title: string;
  /** who it concerns */
  where: string;
  /** the fix, or the extra fact that makes it actionable */
  detail?: string;
  href: string;
}

export interface AttentionGroup {
  kind: AttentionItem["kind"];
  title: string;
  /** what this group means, for the first time somebody sees it */
  hint: string;
  items: AttentionItem[];
}

const GROUPS: Array<{ kind: AttentionItem["kind"]; title: string; hint: string }> = [
  {
    kind: "email",
    title: "Emails that never went out",
    hint: "Past their date with nothing delivered. They will not send by themselves — open each one and send it, or cancel it.",
  },
  {
    kind: "address",
    title: "Addresses that came back",
    hint: "The provider rejected these. Until the address is corrected, that person receives nothing.",
  },
  {
    kind: "sender",
    title: "Campaigns with nobody to send from",
    hint: "No sender chosen, so lessons are held rather than sent under a name nobody picked.",
  },
  {
    kind: "session",
    title: "Sessions with no date",
    hint: "A series only goes on the calendar once the session that triggers it has a date.",
  },
  {
    kind: "client",
    title: "Clients still missing something",
    hint: "Set-up details that are not filled in yet. Each one costs something later.",
  },
];

export function attentionItems(
  clients: Client[],
  templates: SeriesTemplate[],
  staff: StaffMember[],
  today: Date = new Date()
): AttentionGroup[] {
  const items: AttentionItem[] = [];

  // ——— emails that never went out ————————————————————————————
  for (const item of mailboxItems(clients, templates, staff, today)) {
    if (item.status !== "missed" && item.status !== "failed") continue;
    items.push({
      id: `email-${item.campaign.id}-${item.step.id}`,
      kind: "email",
      urgency: "now",
      title: `${item.step.code} · ${item.step.title}`,
      where: `${item.client.shortName} · ${item.campaign.name}`,
      detail: item.failure
        ? `Refused: ${item.failure.error ?? "no reason given"}`
        : item.date
          ? `Due ${item.date.toLocaleDateString("en-US")}, nothing delivered`
          : "Nothing delivered",
      href: "/mailbox?scope=notsent",
    });
  }

  for (const client of clients) {
    // ——— addresses that came back ————————————————————————————
    for (const member of client.members) {
      const event = member.delivery?.event;
      if (event !== "bounced" && event !== "complained") continue;
      items.push({
        id: `address-${member.id}`,
        kind: "address",
        urgency: "now",
        title: member.name,
        where: client.shortName,
        detail:
          event === "complained"
            ? `${member.email} marked it as spam`
            : `${member.email} does not accept mail`,
        href: `/clients/${client.id}`,
      });
    }

    // ——— campaigns ————————————————————————————————————————————
    for (const campaign of client.campaigns) {
      const status = campaignStatus(campaign, templates, today);
      if (status === "closed") continue;

      if (!campaign.senderStaffId && !campaign.senderMemberId) {
        const falling = emailSenderFor(client, campaign, staff);
        items.push({
          id: `sender-${campaign.id}`,
          kind: "sender",
          urgency: falling ? "soon" : "now",
          title: campaign.name,
          where: client.shortName,
          detail: falling
            ? `Would go out as ${falling.name}, picked from the team card`
            : "Nothing can be sent until somebody is chosen",
          href: `/campaigns/${campaign.id}`,
        });
      }

      const undated = campaign.sessions.filter((s) => !s.date);
      if (undated.length)
        items.push({
          id: `session-${campaign.id}`,
          kind: "session",
          urgency: "soon",
          title: `${undated.length} session${undated.length === 1 ? "" : "s"} with no date`,
          where: `${client.shortName} · ${campaign.name}`,
          detail: undated.map((s) => s.name).slice(0, 3).join(", "),
          href: `/campaigns/${campaign.id}`,
        });
    }

    // ——— clients still missing something ——————————————————————
    const missing: string[] = [];
    if (!client.state) missing.push("state");
    if (!client.inviteUrl) missing.push("invitation link");
    if (!client.spaceUrl) missing.push("space link");
    if (!client.planUrl) missing.push("plan link");
    if (!findStaff(staff, client.phoenixLeaderId)) missing.push("Phoenix Leader");
    if (!findStaff(staff, client.phoenixCoachId)) missing.push("Phoenix Coach");
    if (!client.members.length) missing.push("their team");
    if (missing.length)
      items.push({
        id: `client-${client.id}`,
        kind: "client",
        // an invitation link nobody has is the one that stops the work;
        // the rest cost time rather than blocking it
        urgency: !client.inviteUrl || !client.members.length ? "now" : "soon",
        title: client.name,
        where: `${missing.length} missing`,
        detail: missing.join(", "),
        href: `/clients/${client.id}`,
      });
  }

  return GROUPS.map((g) => ({
    ...g,
    items: items
      .filter((i) => i.kind === g.kind)
      .sort((a, b) => (a.urgency === b.urgency ? 0 : a.urgency === "now" ? -1 : 1)),
  })).filter((g) => g.items.length > 0);
}

/** How many things are waiting, and how many of them cannot wait. */
export function attentionCount(groups: AttentionGroup[]) {
  const all = groups.flatMap((g) => g.items);
  return { total: all.length, now: all.filter((i) => i.urgency === "now").length };
}
