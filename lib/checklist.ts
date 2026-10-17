// The set-up checklist: what a client and a campaign need before the
// first email can go out, in the order the work is done.
//
// Nothing here is a new fact. Every line reads what the pages already
// know — a responsible chosen, a link pasted, a date filled, an
// agreement sent — and says whether it is there. Its value is the
// order and the completeness: the one place that shows the whole path
// from "new client" to "first lesson delivered", with the gaps.

import { effectiveRole, findStaff } from "./store";
import type { Campaign, Client, Member, StaffMember } from "./types";

export interface Step {
  id: string;
  label: string;
  done: boolean;
  /** what is still missing — or, once done, what is there */
  detail: string;
  /** where it is done */
  href: string;
  /** the question the help page answers about this step */
  help: string;
}

const active = (m: Member) => !m.status || m.status === "active";
const n = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export function clientSteps(client: Client, staff: StaffMember[]): Step[] {
  const here = `/clients/${client.id}`;
  const leader = findStaff(staff, client.phoenixLeaderId);
  const coach = findStaff(staff, client.phoenixCoachId);
  const manager = findStaff(staff, client.projectManagerId);
  const people = client.members.filter(active);
  const missingFacts = [
    !client.state && "state",
    !client.city && "city",
    !client.website && "website",
  ].filter(Boolean) as string[];
  const links = [client.spaceUrl, client.planUrl, client.inviteUrl].filter(Boolean).length;

  return [
    {
      id: "responsibles",
      label: "Phoenix responsibles chosen",
      done: Boolean(leader && coach),
      detail:
        !leader && !coach
          ? "Leader and Coach still to choose"
          : !leader
            ? "Leader still to choose"
            : !coach
              ? "Coach still to choose"
              : manager
                ? `${leader!.name}, ${coach!.name}, ${manager.name}`
                : `${leader!.name} and ${coach!.name} — no project manager yet`,
      href: here,
      help: "Who are the Phoenix responsibles on a client and what does each one do?",
    },
    {
      id: "members",
      label: "Members on the list",
      done: people.length > 0,
      detail: people.length
        ? `${n(people.length, "person", "people")} on the list`
        : "Nobody yet — import their list, or add them one by one",
      href: here,
      help: "How do I import a client's member list from an Excel file?",
    },
    {
      id: "facts",
      label: "State, city and website",
      done: missingFacts.length === 0,
      detail: missingFacts.length
        ? `Missing: ${missingFacts.join(", ")}`
        : `${client.city}, ${client.state} · ${client.website}`,
      href: here,
      help: "Why does a client need a state, and where do I fill in the city and website?",
    },
    {
      id: "space",
      label: "Space created in the community",
      done: Boolean(client.spaceUrl),
      detail: client.spaceUrl
        ? "Its link is here"
        : "Duplicate the Client Space Template, brand it, then paste its link",
      href: "/community",
      help: "How do I create a client's space in Mighty Networks?",
    },
    {
      id: "plan",
      label: "Plan created in the community",
      done: Boolean(client.planUrl),
      detail: client.planUrl
        ? "Its link is here"
        : "Duplicate the Client Plan Template and point it at the space",
      href: "/community",
      help: "How do I create a client's plan in Mighty Networks?",
    },
    {
      id: "links",
      label: "Space, plan and invitation links",
      done: links === 3,
      detail: links === 3 ? "All three are here" : `${3 - links} of 3 still missing`,
      href: "/community",
      help: "Where do I find a client's space link, plan link and invitation link?",
    },
    {
      id: "campaign",
      label: "First campaign",
      done: client.campaigns.length > 0,
      detail: client.campaigns.length
        ? n(client.campaigns.length, "campaign")
        : "Start one with + New campaign",
      href: here,
      help: "How do I create a campaign for a client?",
    },
  ];
}

export function campaignSteps(
  client: Client,
  campaign: Campaign,
  staff: StaffMember[]
): Step[] {
  const here = `/campaigns/${campaign.id}`;
  const undated = campaign.sessions.filter((s) => !s.date);
  const leader = effectiveRole(client, campaign, "phoenixLeaderId", staff);
  const coach = effectiveRole(client, campaign, "phoenixCoachId", staff);
  const sender = Boolean(campaign.senderStaffId || campaign.senderMemberId);
  const people = client.members.filter(active);
  const noEmail = people.filter((m) => !m.email);
  const agreementPending = people.filter((m) => !m.agreementSignedAt && !m.agreementSentAt);
  const invitePending = people.filter((m) => !m.communityJoinedAt && !m.communityInvitedAt);
  const notIn = people.filter((m) => m.communityInvitedAt && !m.communityJoinedAt);

  return [
    {
      id: "sessions",
      label: "All session dates set",
      done: campaign.sessions.length > 0 && undated.length === 0,
      detail:
        campaign.sessions.length === 0
          ? "No sessions yet"
          : undated.length
            ? `${undated.length} of ${campaign.sessions.length} without a date — ${undated
                .map((s) => s.name)
                .slice(0, 3)
                .join(", ")}`
            : `${n(campaign.sessions.length, "session")}, all dated`,
      href: here,
      help: "How do I set the session dates of a campaign?",
    },
    {
      id: "team",
      label: "Phoenix team, and who the emails come from",
      done: Boolean(leader && coach && sender),
      detail: !sender
        ? "Nobody chosen under Emails sent by — nothing goes out until somebody is"
        : !leader || !coach
          ? `${!leader ? "Leader" : "Coach"} still to choose`
          : `${leader!.name}, ${coach!.name} — sender chosen`,
      href: here,
      help: "How do I choose who the campaign emails are sent from?",
    },
    {
      id: "people",
      label: "Team members checked",
      done: people.length > 0 && noEmail.length === 0,
      detail:
        people.length === 0
          ? "Nobody on the client's list yet"
          : noEmail.length
            ? `${n(noEmail.length, "person", "people")} without an email address`
            : `${n(people.length, "person", "people")}, every one with an address`,
      href: `/clients/${client.id}`,
      help: "How do I add or adjust the members of a client?",
    },
    {
      id: "agreement",
      label: "User agreement sent",
      done: people.length > 0 && agreementPending.length === 0,
      detail:
        people.length === 0
          ? "Nobody to send it to yet"
          : agreementPending.length
            ? `${agreementPending.length} of ${people.length} not sent yet`
            : "Sent to everyone",
      href: here,
      help: "How do I send the user agreement to a client's team?",
    },
    {
      id: "invite",
      label: "Invited to the community",
      done: people.length > 0 && invitePending.length === 0,
      detail:
        people.length === 0
          ? "Nobody to invite yet"
          : invitePending.length
            ? `${invitePending.length} of ${people.length} not invited yet`
            : "Everyone invited",
      href: here,
      help: "How do I invite a client's team into the community?",
    },
    {
      id: "remind",
      label: "Reminders, if needed",
      done: notIn.length === 0,
      detail: notIn.length
        ? `${n(notIn.length, "person", "people")} invited but not in yet — remind them`
        : "Everyone invited is in",
      href: here,
      help: "How do I remind people who have not joined the community yet?",
    },
  ];
}
