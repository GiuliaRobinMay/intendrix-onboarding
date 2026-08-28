-- Intendrix — personal sign-offs, shadow copies, and a test-send log
--
-- Three small additions, all optional:
--
--  * staff.signature       the exact block a person's lessons sign off
--                          with. Empty falls back to their name and role.
--  * campaigns.shadow_emails
--                          addresses that receive one copy of every
--                          lesson this campaign sends — the coordinator
--                          watching a live programme without being on the
--                          participant list.
--  * email_sends.shadow_to which shadow address a logged copy went to.
--                          Keeps the "never send the same thing twice"
--                          check working for copies as well as members.

alter table staff
  add column if not exists signature text;

comment on column staff.signature is
  'Sign-off block for this person''s lesson emails. Plain text, one line per line. Empty = name and role.';

alter table campaigns
  add column if not exists shadow_emails text;

comment on column campaigns.shadow_emails is
  'Comma- or newline-separated addresses that get one copy of every lesson this campaign sends. Not recipients — they are never personalised or counted as members.';

alter table email_sends
  add column if not exists shadow_to text;

comment on column email_sends.shadow_to is
  'Set when this row logs a shadow copy rather than a member send.';

-- A client admin is a person, not an address. Their name belongs on the
-- invitation so the list reads like the team list does.
alter table invitations
  add column if not exists name text;

comment on column invitations.name is
  'The invited person''s name, shown in the app before they have an account.';
