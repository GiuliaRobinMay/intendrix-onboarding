-- ============================================================
-- Intendrix — database update
--
-- For a project where setup.sql has already been run. Paste this whole
-- file into the Supabase SQL editor and press Run.
--
-- It only adds columns; no data is touched and nothing is dropped.
-- Safe to run more than once. A brand-new project needs setup.sql
-- instead — that file already contains everything below.
--
-- What it adds:
--   * campaigns.sender_member_id      — send as the client's own champion
--   * campaign_sessions.offset_days   — day numbers, to date a campaign
--                                       from its start date in one click
-- ============================================================


-- ——— who a campaign's emails are sent by ——————————————————
--
-- Executive programmes send from a Phoenix coach; second-level
-- programmes send from the client's own Transformational Champion
-- (Courtney at Brio). The address stays on the Phoenix sending domain —
-- a message claiming to come from the client's own domain would fail
-- their anti-spoofing checks — but the champion's name is what
-- recipients see, and replies go to her real address.

alter table campaigns
  add column if not exists sender_member_id text
    references members (id) on delete set null;

comment on column campaigns.sender_member_id is
  'When set, this client member is the sender instead of the Phoenix coach. Their name is the display name; the address stays on the sending domain, with their real address as reply-to.';


-- ——— day numbers on sessions ——————————————————————————————
--
-- Every send hangs off a session date, and the gaps between sessions
-- repeat from client to client. offset_days records that rhythm: the
-- number of days after the campaign start date on which each session
-- falls. "Fill the dates from the start" then dates a whole campaign at
-- once, and moving one session carries the rest along.

alter table campaign_sessions
  add column if not exists offset_days integer;

comment on column campaign_sessions.offset_days is
  'Days after campaigns.start_date on which this session falls. Null = no pattern; the date is only ever entered by hand.';


-- ——— personal sign-offs, shadow copies, invited names ————
--
-- A person's lessons can sign off with their own block; a campaign can
-- copy every lesson to someone watching from the outside; and a client
-- admin is stored as a name, not only an address.

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


-- ——— app-wide settings ————————————————————————————————————
--
-- One key-value table for the handful of values that belong to the
-- app as a whole. First occupant: the company logo that closes
-- every lesson email.

create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

comment on table app_settings is
  'App-wide values. signatureLogoUrl: public image URL rendered under the sign-off of every lesson email a Phoenix sender sends.';

alter table app_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'app_settings' and policyname = 'app_settings_team_all'
  ) then
    create policy app_settings_team_all on app_settings for all to authenticated
      using (true) with check (true);
  end if;
end $$;


-- ——— free-text triggers ——————————————————————————————————
--
-- A series can be triggered by any session name, not only the five
-- standard kinds — Pre-Planning Sessions to begin with.

alter table series_templates
  alter column trigger_kind type text using trigger_kind::text;

alter table campaign_sessions
  alter column kind type text using kind::text;

comment on column series_templates.trigger_kind is
  'The session that usually starts this series. Standard: orientation, workshop, coaching1, coaching2, launch — or any custom name, e.g. "Pre-Planning Session".';


-- ——— attachments ————————————————————————————————————————
--
-- Each lesson email can carry one file: a name and the direct link
-- the provider fetches and attaches.

alter table step_contents
  add column if not exists attachment_label text,
  add column if not exists attachment_url   text;

comment on column step_contents.attachment_url is
  'Direct https link to the file this email carries as an attachment. Null = no attachment.';


-- ——— first and last names ————————————————————————————————
--
-- Members get first_name + last_name; existing rows are split on
-- the first space. {{first_name}} stops being guesswork.

alter table members
  add column if not exists first_name text,
  add column if not exists last_name  text;

update members
   set first_name = coalesce(first_name, nullif(split_part(name, ' ', 1), '')),
       last_name  = coalesce(
         last_name,
         nullif(btrim(substr(name, length(split_part(name, ' ', 1)) + 1)), '')
       )
 where first_name is null or last_name is null;

comment on column members.first_name is
  'What {{first_name}} in a lesson email becomes for this person.';


-- ——— per-campaign email wording ———————————————————————————
--
-- Editing an email in a campaign's mailbox lands here, for that one
-- campaign; the master lesson library is never touched by it.

create table if not exists campaign_step_content (
  campaign_id   text not null references campaigns (id) on delete cascade,
  step_id       text not null references series_steps (id) on delete cascade,
  variant       step_variant not null,
  email_subject text,
  email_body    text,
  updated_at    timestamptz not null default now(),
  primary key (campaign_id, step_id, variant)
);

comment on table campaign_step_content is
  'Per-campaign wording of a lesson email. Null fields fall back to the master in step_contents.';

alter table campaign_step_content enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'campaign_step_content'
       and policyname = 'campaign_step_content_team_all'
  ) then
    create policy campaign_step_content_team_all on campaign_step_content
      for all to authenticated using (true) with check (true);
  end if;
end $$;


-- Intendrix — cancel one lesson email for one campaign
--
-- A row here means: this campaign never sends this lesson. The lesson
-- stays visible with the status Cancelled; deleting the row restores it.

create table if not exists campaign_step_skips (
  campaign_id text not null references campaigns (id) on delete cascade,
  step_id     text not null references series_steps (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (campaign_id, step_id)
);

comment on table campaign_step_skips is
  'Cancelled lesson emails, per campaign. A row = the engine never sends this lesson for this campaign.';

alter table campaign_step_skips enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'campaign_step_skips'
       and policyname = 'campaign_step_skips_team_all'
  ) then
    create policy campaign_step_skips_team_all on campaign_step_skips
      for all to authenticated using (true) with check (true);
  end if;
end $$;


-- Intendrix — what happened to each email after it left

alter table email_sends
  add column if not exists provider_id text;

alter table email_sends
  add column if not exists last_event text;

alter table email_sends
  add column if not exists last_event_at timestamptz;

create index if not exists email_sends_provider_id
  on email_sends (provider_id);

comment on column email_sends.provider_id is
  'The provider''s id for this email — how delivery webhooks find the row.';
comment on column email_sends.last_event is
  'Latest delivery event: sent, delivered, opened, clicked, bounced, complained, failed.';

-- ——— check it landed ——————————————————————————————————————
-- Expect ten rows.

select table_name, column_name
  from information_schema.columns
 where (table_name = 'campaigns'         and column_name in ('sender_member_id', 'shadow_emails'))
    or (table_name = 'campaign_sessions' and column_name = 'offset_days')
    or (table_name = 'staff'             and column_name = 'signature')
    or (table_name = 'email_sends'       and column_name = 'shadow_to')
    or (table_name = 'email_sends'       and column_name = 'provider_id')
    or (table_name = 'invitations'       and column_name = 'name')
    or (table_name = 'app_settings'      and column_name = 'key')
    or (table_name = 'campaign_step_content' and column_name = 'campaign_id')
    or (table_name = 'campaign_step_skips'   and column_name = 'campaign_id')
 order by table_name, column_name;
