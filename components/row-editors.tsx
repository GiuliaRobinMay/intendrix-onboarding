"use client";

// The cells of a list that can be put right where you notice they are
// wrong — status, who is responsible, who the emails come from.
//
// All three were read-only, so spotting a mistake in a list of nine
// campaigns meant opening nine pages to fix it, and nobody does that:
// the list stays wrong instead. Each of these writes the same field
// the campaign page writes, through the same action.

import { RowSelect } from "@/components/row-select";
import { CAMPAIGN_TONE, CLIENT_TONE } from "@/lib/status-colors";
import { useData } from "@/lib/state";
import { ROLE_TO_ASSIGNMENT, findStaff, type PhoenixRole } from "@/lib/store";
import type { Campaign, CampaignStatus, Client, StaffMember } from "@/lib/types";

const ROLE_NAME: Record<PhoenixRole, string> = {
  phoenixLeaderId: "Phoenix Leader",
  phoenixCoachId: "Phoenix Coach",
  projectManagerId: "Project Manager",
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

const STATUS_TONE = CAMPAIGN_TONE;

/** Status, where empty means "whatever the dates and the schedule say".
 *  Choosing the derived value is the same as choosing nothing, so it
 *  clears the override rather than freezing today's answer forever. */
export function CampaignStatusSelect({
  client,
  campaign,
  derived,
}: {
  client: Client;
  campaign: Campaign;
  derived: CampaignStatus;
}) {
  const { dispatch } = useData();
  return (
    <RowSelect
      tip="Upcoming, Active and Closed follow the campaign's Runs dates by themselves. Pick one here to overrule that — Paused and Closed are the ones worth saying out loud."
      value={campaign.statusOverride ?? ""}
      // dimmed and italic already means "nobody set this, it is
      // being worked out" — the same convention as the two columns
      // beside it. Spelling out "Automatic" as well did not fit.
      // the colour is the status, not how it was arrived at: an Active
      // campaign is green whether somebody said so or the dates did
      placeholder={STATUS_LABEL[derived]}
      tone={STATUS_TONE[campaign.statusOverride ?? derived]}
      options={(Object.keys(STATUS_LABEL) as CampaignStatus[]).map((s) => ({
        value: s,
        label: STATUS_LABEL[s],
      }))}
      onChange={(v) =>
        dispatch({
          type: "updateCampaign",
          clientId: client.id,
          campaignId: campaign.id,
          patch: {
            statusOverride:
              v === "" || v === derived ? undefined : (v as CampaignStatus),
          },
        })
      }
    />
  );
}

/** One Phoenix role on one campaign. Empty inherits the client's
 *  person, and says whose name that is rather than "Unassigned" —
 *  those are different facts and the list used to show them alike. */
export function RoleSelect({
  client,
  campaign,
  role,
  staff,
}: {
  client: Client;
  campaign: Campaign;
  role: PhoenixRole;
  staff: StaffMember[];
}) {
  const { dispatch } = useData();
  const assignmentRole = ROLE_TO_ASSIGNMENT[role];
  const roleName = ROLE_NAME[role];
  const own = campaign.phoenixTeam.find((a) => a.role === assignmentRole);
  const inherited = findStaff(staff, client[role]);
  return (
    <RowSelect
      tip={
        own
          ? `${roleName} for this campaign only`
          : inherited
            ? `From the client. Pick somebody to give this campaign its own ${roleName}.`
            : `No ${roleName} anywhere — on this campaign or on the client`
      }
      value={own?.staffId ?? ""}
      // the name, however it got here. Where it came from is in the
      // tooltip, which is the right weight for a detail nobody needs
      // while scanning a list.
      placeholder={inherited ? inherited.name : "Unassigned"}
      options={staff.map((p) => ({ value: p.id, label: p.name }))}
      onChange={(v) => {
        if (!v) {
          if (own)
            dispatch({
              type: "removePhoenixAssignment",
              clientId: client.id,
              campaignId: campaign.id,
              assignmentId: own.id,
            });
          return;
        }
        dispatch({
          type: "addPhoenixAssignment",
          clientId: client.id,
          campaignId: campaign.id,
          staffId: v,
          role: assignmentRole,
        });
      }}
    />
  );
}

/** Who the emails come from: anyone at Phoenix, or one of the client's
 *  own people. Never inferred — the address is printed underneath,
 *  because that is the thing a client actually sees. */
export function SenderSelect({
  client,
  campaign,
  staff,
}: {
  client: Client;
  campaign: Campaign;
  staff: StaffMember[];
}) {
  const { dispatch } = useData();
  const value = campaign.senderStaffId
    ? `staff:${campaign.senderStaffId}`
    : campaign.senderMemberId
      ? `member:${campaign.senderMemberId}`
      : "";
  const chosen = campaign.senderStaffId
    ? findStaff(staff, campaign.senderStaffId)
    : null;
  const member = campaign.senderMemberId
    ? client.members.find((m) => m.id === campaign.senderMemberId)
    : null;
  const address = chosen?.email ?? member?.email ?? null;

  return (
    <RowSelect
      tip="The name and address on this campaign's lesson emails. Nothing is assumed: until somebody is picked, this campaign has no sender."
      value={value}
      placeholder="Nobody chosen"
      options={[
        ...staff.map((p) => ({ value: `staff:${p.id}`, label: p.name })),
        ...client.members.map((m) => ({
          value: `member:${m.id}`,
          label: `${m.name} · ${client.shortName}`,
        })),
      ]}
      onChange={(v) => {
        const [kind, id] = v.split(":");
        dispatch({
          type: "updateCampaign",
          clientId: client.id,
          campaignId: campaign.id,
          patch: {
            senderStaffId: kind === "staff" ? id : null,
            senderMemberId: kind === "member" ? id : null,
          },
        });
      }}
      sub={
        address ? (
          <span className="block truncate pl-1 text-[10px] text-mist/70">
            {address}
          </span>
        ) : null
      }
    />
  );
}

const CLIENT_STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: CLIENT_TONE.active },
  onboarding: { label: "Onboarding", tone: CLIENT_TONE.onboarding },
  archived: { label: "Archived", tone: CLIENT_TONE.archived },
};

/** A client's own status, set outright — there is nothing to derive it
 *  from, which is why it so often stayed on whatever it was created as. */
export function ClientStatusSelect({ client }: { client: Client }) {
  const { dispatch } = useData();
  return (
    <RowSelect
      tip="Onboarding while their space is being set up, Active once the programme is running, Archived when it is over"
      value={client.status}
      placeholder="Active"
      tone={CLIENT_STATUS[client.status]?.tone}
      options={Object.entries(CLIENT_STATUS).map(([value, s]) => ({
        value,
        label: s.label,
      }))}
      onChange={(v) =>
        dispatch({
          type: "updateClient",
          clientId: client.id,
          patch: { status: (v || "active") as Client["status"] },
        })
      }
    />
  );
}

/** A Phoenix role on the client itself. Every campaign for them starts
 *  from this, so it is the one worth getting right first. */
export function ClientRoleSelect({
  client,
  role,
  staff,
}: {
  client: Client;
  role: PhoenixRole;
  staff: StaffMember[];
}) {
  const { dispatch } = useData();
  return (
    <RowSelect
      tip={`${ROLE_NAME[role]} for this client. Campaigns start from this and can each be given their own.`}
      value={client[role] ?? ""}
      placeholder="Unassigned"
      options={staff.map((p) => ({ value: p.id, label: p.name }))}
      onChange={(v) =>
        dispatch({
          type: "updateClient",
          clientId: client.id,
          patch: { [role]: v || undefined },
        })
      }
    />
  );
}
