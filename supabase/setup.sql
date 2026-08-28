-- ============================================================
-- Intendrix Team Backend — complete database setup
-- Project: paste this whole file into the Supabase SQL editor
-- (SQL Editor → New query → paste → Run). One run does it all:
--   1. schema (16 tables, enums, triggers)
--   2. sign-in: roles, profiles, invitations, scoped RLS
--   3. seed: Phoenix team, TLE blueprints + lessons, 5 clients
-- Idempotent seed — safe to re-run. Generated from the repo:
--   supabase/migrations/0001_initial_schema.sql
--   supabase/migrations/0002_auth_roles_invitations.sql
--   supabase/migrations/0003_campaign_sender.sql
--   supabase/migrations/0004_session_offsets.sql
--   supabase/migrations/0005_email_personalisation.sql
--   supabase/seed.sql
-- ============================================================

-- Intendrix Team Backend — initial schema
-- Mirrors lib/types.ts (prototype model, seed version 7).
-- Apply in the Supabase SQL editor, or with `supabase db push`.
--
-- Conventions:
--  * Primary keys are text so the prototype's readable ids ("caresouth",
--    "poea") can be imported as-is; new rows default to a generated uuid.
--  * All tables carry created_at/updated_at with an auto-touch trigger.
--  * RLS is enabled everywhere with a single "team members only" policy:
--    any authenticated user can read and write. This matches an internal
--    team tool; tighten per-role later when roles arrive.

create extension if not exists pgcrypto;

-- ——— enums ————————————————————————————————————————————————

create type session_kind as enum (
  'orientation', 'workshop', 'coaching1', 'coaching2', 'launch'
);

create type session_mode as enum ('virtual', 'in-person');

create type client_status as enum ('active', 'onboarding', 'archived');

create type campaign_status as enum ('upcoming', 'active', 'paused', 'closed');

create type member_role as enum ('leader', 'participant', 'coach');

create type step_variant as enum ('participant', 'leader');

create type phoenix_assignment_role as enum (
  'phoenix_leader', 'phoenix_coach', 'project_manager'
);

create type client_assignment_role as enum ('champion', 'contact');

-- ——— shared updated_at trigger ————————————————————————————

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ——— Phoenix staff ————————————————————————————————————————

create table staff (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  role_title    text not null default '',
  initials      text not null default '',
  email         text not null unique,          -- the unique sender address
  scheduling_url text,                         -- leader/coach scheduling link
  auth_user_id  uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ——— clients & members ————————————————————————————————————

create table clients (
  id                 text primary key default gen_random_uuid()::text,
  name               text not null,
  short_name         text not null default '',
  location           text not null default '',
  sector             text not null default '',
  status             client_status not null default 'onboarding',
  -- Phoenix defaults; campaigns can override via assignments
  phoenix_leader_id  text references staff (id) on delete set null,
  phoenix_coach_id   text references staff (id) on delete set null,
  project_manager_id text references staff (id) on delete set null,
  space_url          text,                     -- Mighty Networks space
  invite_url         text,                     -- plan invitation link
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table members (
  id         text primary key default gen_random_uuid()::text,
  client_id  text not null references clients (id) on delete cascade,
  name       text not null,
  email      text not null default '',
  role       member_role not null default 'participant',
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index members_client_idx on members (client_id);

-- ——— campaign blueprints (Settings → Campaigns) ———————————

create table campaign_templates (
  id          text primary key default gen_random_uuid()::text,
  code        text not null,
  name        text not null,
  description text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table series_templates (
  id                   text primary key default gen_random_uuid()::text,
  campaign_template_id text not null references campaign_templates (id) on delete cascade,
  code                 text not null,
  name                 text not null,
  focus                text not null default '',
  trigger_kind         session_kind not null default 'orientation',
  color                text not null default '#eb320f',
  sort_order           int  not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index series_templates_campaign_idx on series_templates (campaign_template_id);

create table series_steps (
  id                 text primary key default gen_random_uuid()::text,
  series_template_id text not null references series_templates (id) on delete cascade,
  code               text not null,               -- e.g. "POEA 1.4" (display)
  title              text not null,
  offset_days        int  not null default 7,     -- after previous step / trigger
  send_time          time not null default '08:00',
  sort_order         int  not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index series_steps_series_idx on series_steps (series_template_id);

-- one row per audience variant (participant / leader) per step
create table step_contents (
  id            text primary key default gen_random_uuid()::text,
  step_id       text not null references series_steps (id) on delete cascade,
  variant       step_variant not null,
  email_subject text not null default '',
  email_body    text not null default '',
  lesson_label  text,
  lesson_url    text,                             -- null = link missing (flagged)
  team_meeting  text,                             -- TEAM MEETING instruction
  note          text,                             -- production note
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (step_id, variant)
);

-- extra links riding along (Leaders Guides etc.)
create table step_links (
  id              text primary key default gen_random_uuid()::text,
  step_content_id text not null references step_contents (id) on delete cascade,
  label           text not null,
  url             text,
  sort_order      int  not null default 0
);
create index step_links_content_idx on step_links (step_content_id);

-- ——— campaigns (delivery side) ————————————————————————————

create table campaigns (
  id              text primary key default gen_random_uuid()::text,
  client_id       text not null references clients (id) on delete cascade,
  template_id     text references campaign_templates (id) on delete set null,
  code            text not null default 'TLE',
  name            text not null,
  timezone        text not null default 'America/New_York',
  status_override campaign_status,                -- null = derived from schedule
  start_date      date,
  end_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index campaigns_client_idx on campaigns (client_id);

create table campaign_sessions (
  id           text primary key default gen_random_uuid()::text,
  campaign_id  text not null references campaigns (id) on delete cascade,
  name         text not null,
  session_date date,                              -- null = not planned yet
  mode         session_mode not null default 'virtual',
  kind         session_kind,                      -- null for custom sessions
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index campaign_sessions_campaign_idx on campaign_sessions (campaign_id);

-- a series template loaded into a campaign, bound to a trigger session
create table campaign_series (
  id                 text primary key default gen_random_uuid()::text,
  campaign_id        text not null references campaigns (id) on delete cascade,
  series_template_id text not null references series_templates (id) on delete cascade,
  trigger_session_id text references campaign_sessions (id) on delete set null,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (campaign_id, series_template_id)
);
create index campaign_series_campaign_idx on campaign_series (campaign_id);

-- Phoenix people on a campaign (person + role, any number)
create table campaign_phoenix_assignments (
  id          text primary key default gen_random_uuid()::text,
  campaign_id text not null references campaigns (id) on delete cascade,
  staff_id    text not null references staff (id) on delete cascade,
  role        phoenix_assignment_role not null default 'phoenix_coach',
  created_at  timestamptz not null default now()
);
create index cpa_campaign_idx on campaign_phoenix_assignments (campaign_id);

-- client members on a campaign (member + role, any number)
create table campaign_client_assignments (
  id          text primary key default gen_random_uuid()::text,
  campaign_id text not null references campaigns (id) on delete cascade,
  member_id   text not null references members (id) on delete cascade,
  role        client_assignment_role not null default 'champion',
  created_at  timestamptz not null default now()
);
create index cca_campaign_idx on campaign_client_assignments (campaign_id);

-- ——— email log (for the sending engine, phase 3) ——————————
-- The Mailbox derives its view from the schedule; this table records what
-- the engine actually sent, one row per member per send.

create table email_sends (
  id             text primary key default gen_random_uuid()::text,
  campaign_id    text not null references campaigns (id) on delete cascade,
  step_id        text not null references series_steps (id) on delete cascade,
  member_id      text references members (id) on delete set null,
  variant        step_variant not null,
  sender_id      text references staff (id) on delete set null,
  scheduled_for  timestamptz not null,
  sent_at        timestamptz,
  status         text not null default 'scheduled',  -- scheduled|sent|failed|held
  error          text,
  created_at     timestamptz not null default now()
);
create index email_sends_campaign_idx on email_sends (campaign_id);
create index email_sends_scheduled_idx on email_sends (scheduled_for)
  where sent_at is null;

-- ——— updated_at triggers ——————————————————————————————————

do $$
declare t text;
begin
  foreach t in array array[
    'staff','clients','members','campaign_templates','series_templates',
    'series_steps','step_contents','campaigns','campaign_sessions',
    'campaign_series'
  ] loop
    execute format(
      'create trigger %I before update on %I
         for each row execute function touch_updated_at()',
      t || '_touch', t
    );
  end loop;
end $$;

-- ——— row level security ———————————————————————————————————
-- Internal team tool: every authenticated user (the Phoenix team, invited
-- by email + password) may read and write everything. Tighten when roles
-- arrive ("who can edit blueprints vs run campaigns").

do $$
declare t text;
begin
  foreach t in array array[
    'staff','clients','members','campaign_templates','series_templates',
    'series_steps','step_contents','step_links','campaigns',
    'campaign_sessions','campaign_series','campaign_phoenix_assignments',
    'campaign_client_assignments','email_sends'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (true) with check (true)',
      t || '_team_all', t
    );
  end loop;
end $$;

-- ═══ 0002: auth, roles & invitations ═══

-- Intendrix Team Backend — auth, roles and invitations
-- Run AFTER 0001_initial_schema.sql.
--
-- Sign-in model (Brad's choice): email address as account name + password.
-- People are invited FROM INSIDE THE APP; the invite email lets them set
-- their own password (Supabase's inviteUserByEmail handles delivery).
--
-- Roles, designed for the future Giulia described:
--  * phoenix_admin — the Phoenix team; sees and edits everything.
--  * client_admin  — an external person at a client who runs certain
--    campaigns; sees ONLY their own company and its campaigns.

-- ——— roles & profiles ————————————————————————————————————

create type app_role as enum ('phoenix_admin', 'client_admin');

-- one row per signed-up user; provisioned automatically from the matching
-- invitation when the account is created. role null = no access yet.
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       app_role,
  client_id  text references clients (id) on delete cascade,
  staff_id   text references staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_admin_needs_client
    check (role is distinct from 'client_admin' or client_id is not null)
);
create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

-- ——— invitations (created from inside the app) ————————————

create table invitations (
  id          text primary key default gen_random_uuid()::text,
  email       text not null,
  role        app_role not null,
  client_id   text references clients (id) on delete cascade,
  staff_id    text references staff (id) on delete set null,
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  constraint invite_client_admin_needs_client
    check (role is distinct from 'client_admin' or client_id is not null)
);
create index invitations_email_idx on invitations (lower(email));

-- when a user signs up, copy role/scope from their pending invitation
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invitations%rowtype;
begin
  select * into inv
    from invitations
   where lower(email) = lower(new.email) and accepted_at is null
   order by created_at desc
   limit 1;

  insert into profiles (id, email, full_name, role, client_id, staff_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    inv.role,          -- null when nobody invited them → no access
    inv.client_id,
    inv.staff_id
  );

  if inv.id is not null then
    update invitations set accepted_at = now() where id = inv.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ——— RLS helpers ——————————————————————————————————————————

create or replace function is_phoenix_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'phoenix_admin') $$;

create or replace function my_client_id()
returns text language sql stable security definer set search_path = public as
$$ select client_id from profiles where id = auth.uid() and role = 'client_admin' $$;

-- ——— replace the blanket policies from 0001 —————————————————
-- Phoenix admins keep full access everywhere. Client admins are scoped:
-- read their own company + full run-access to its campaigns, read-only on
-- the lesson library, nothing else.

do $$
declare t text;
begin
  foreach t in array array[
    'staff','clients','members','campaign_templates','series_templates',
    'series_steps','step_contents','step_links','campaigns',
    'campaign_sessions','campaign_series','campaign_phoenix_assignments',
    'campaign_client_assignments','email_sends'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_team_all', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (is_phoenix_admin()) with check (is_phoenix_admin())',
      t || '_phoenix_all', t
    );
  end loop;
end $$;

-- profiles: everyone reads their own; phoenix admins manage all
alter table profiles enable row level security;
create policy profiles_self_read on profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_phoenix_all on profiles
  for all to authenticated using (is_phoenix_admin()) with check (is_phoenix_admin());

-- invitations: phoenix admins only
alter table invitations enable row level security;
create policy invitations_phoenix_all on invitations
  for all to authenticated using (is_phoenix_admin()) with check (is_phoenix_admin());

-- client_admin scope: their company (read) …
create policy clients_scoped_read on clients
  for select to authenticated using (id = my_client_id());
create policy members_scoped_read on members
  for select to authenticated using (client_id = my_client_id());

-- … their campaigns (read + run) …
create policy campaigns_scoped_read on campaigns
  for select to authenticated using (client_id = my_client_id());
create policy campaigns_scoped_update on campaigns
  for update to authenticated
  using (client_id = my_client_id()) with check (client_id = my_client_id());

do $$
declare t text;
begin
  foreach t in array array[
    'campaign_sessions','campaign_series',
    'campaign_phoenix_assignments','campaign_client_assignments'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated
         using (campaign_id in (select id from campaigns where client_id = my_client_id()))
         with check (campaign_id in (select id from campaigns where client_id = my_client_id()))',
      t || '_scoped_all', t
    );
  end loop;
end $$;

create policy email_sends_scoped_read on email_sends
  for select to authenticated
  using (campaign_id in (select id from campaigns where client_id = my_client_id()));

-- … the lesson library and staff names, read-only (needed to display
-- series, lessons and responsible people inside their campaigns)
do $$
declare t text;
begin
  foreach t in array array[
    'campaign_templates','series_templates','series_steps',
    'step_contents','step_links','staff'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (auth.uid() is not null)',
      t || '_shared_read', t
    );
  end loop;
end $$;

-- ═══ later schema changes ═══

-- Intendrix — who a campaign's emails are sent by
--
-- Until now the sender was always a Phoenix coach. Brad's rule after the
-- Brio meeting: executive programmes send from a Phoenix coach, but
-- second-level programmes send from the client's own Transformational
-- Champion (e.g. Courtney at Brio).
--
-- The address stays on the Phoenix sending domain — a message claiming to
-- come from the client's own domain would fail their anti-spoofing checks.
-- The champion's name is what recipients see; replies go to her real
-- address.

alter table campaigns
  add column if not exists sender_member_id text
    references members (id) on delete set null;

comment on column campaigns.sender_member_id is
  'When set, this client member is the sender instead of the Phoenix coach. Their name is the display name; the address stays on the sending domain, with their real address as reply-to.';

-- Intendrix — day numbers on sessions, so a start date fills the calendar
--
-- Every send in a campaign hangs off a session date. Entering five session
-- dates by hand for every new client is the slow part, and the intervals
-- between them are the same programme after programme.
--
-- offset_days records that pattern: the number of days after the campaign
-- start date on which the session falls. "Fill dates from start" then
-- writes session_date = campaigns.start_date + offset_days, and moving one
-- session keeps the day numbers of the sessions that follow in step.

alter table campaign_sessions
  add column if not exists offset_days integer;

comment on column campaign_sessions.offset_days is
  'Days after campaigns.start_date on which this session falls. Null = no pattern; the date is only ever entered by hand.';

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

-- ═══ seed data ═══

-- Intendrix Team Backend — seed data
-- Generated from the prototype seed (lib/data.ts, seed version 7).
-- Run AFTER 0001_initial_schema.sql. Idempotent via on conflict do nothing.

-- staff
insert into staff (id, name, role_title, initials, email) values ('brad', 'Brad Zimmerman', 'Phoenix Coach · Owner', 'BZ', 'brad@phoenixperform.com') on conflict (id) do nothing;
insert into staff (id, name, role_title, initials, email) values ('kevin', 'Kevin', 'Phoenix Coach', 'KV', 'kevin@phoenixperform.com') on conflict (id) do nothing;
insert into staff (id, name, role_title, initials, email) values ('amber', 'Amber', 'Program Coordinator', 'AM', 'amber@phoenixperform.com') on conflict (id) do nothing;
insert into staff (id, name, role_title, initials, email) values ('giulia', 'Giulia May', 'Community & Platform', 'GM', 'giulia@phoenixperform.com') on conflict (id) do nothing;

-- campaign blueprints
insert into campaign_templates (id, code, name, description) values ('tle-e', 'TLE-E', 'TLE for Executives', 'The Transformational Leadership Experience for an executive team: five sessions over 26 weeks, each followed by its own series of Intendrix lessons.') on conflict (id) do nothing;
insert into campaign_templates (id, code, name, description) values ('tle-l', 'TLE-L', 'TLE for Leaders', 'The Transformational Leadership Experience for leaders — duplicated from TLE for Executives; one extra series is expected to be inserted.') on conflict (id) do nothing;
insert into campaign_templates (id, code, name, description) values ('tle-ic', 'TLE-IC', 'TLE for Individual Contributors', 'The Transformational Leadership Experience for individual contributors — two series; content and timing to be loaded from Brad''s document.') on conflict (id) do nothing;

-- series, lessons, email variants and extra links
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('poea', 'tle-e', 'POEA', 'Post-Orientation', 'Getting started & personal mastery', 'orientation', '#eb320f', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('poea-1', 'poea', 'POEA 1.2', 'Welcome & Getting Started', 1, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-1-p', 'poea-1', 'participant', 'Welcome to Intendrix — your journey starts now', 'Welcome aboard! In this short video Amber walks you through the logistics: how the lessons arrive, the survey process, and your first homework — go to the New Member Guide in Intendrix and complete your profile.', 'New Member Guide', 'https://intendrix.ai/spaces/22388417/content', null, 'Video pending: Amber re-records the original welcome (no Tom & Brad mention, new survey process, new homework assignment).') on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-1-l', 'poea-1', 'leader', 'Welcome to Intendrix — your journey starts now', 'Welcome aboard! In this short video Amber walks you through the logistics: how the lessons arrive, the survey process, and your first homework — go to the New Member Guide in Intendrix and complete your profile.', 'New Member Guide', 'https://intendrix.ai/spaces/22388417/content', null, 'Video pending: Amber re-records the original welcome (no Tom & Brad mention, new survey process, new homework assignment).') on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('poea-2', 'poea', 'POEA 1.4', 'Personal Mastery', 2, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-2-p', 'poea-2', 'participant', 'Start living by design, not default', 'Your first lesson is here. Personal Mastery is the foundation everything else builds on — take 15 minutes this week to go through it.', 'Personal Mastery', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-start-living-by-design-not-default', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-2-l', 'poea-2', 'leader', 'Start living by design, not default', 'Your first lesson is here. Personal Mastery is the foundation everything else builds on — take 15 minutes this week to go through it.', 'Personal Mastery', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-start-living-by-design-not-default', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('poea-3', 'poea', 'POEA 1.6', 'Growth Mindset', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-3-p', 'poea-3', 'participant', 'Prove to yourself that you are not fixed', 'This week''s lesson: Growth Mindset. Discover how much of what feels fixed about you is actually up for design.', 'Growth Mindset', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-prove-to-yourself-that-you-are-not-fixed', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-3-l', 'poea-3', 'leader', 'Prove to yourself that you are not fixed', 'This week''s lesson: Growth Mindset. Discover how much of what feels fixed about you is actually up for design.', 'Growth Mindset', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-prove-to-yourself-that-you-are-not-fixed', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('poea-4', 'poea', 'POEA 1.7', 'Coaching Relationships', 7, '08:00', 3) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-4-p', 'poea-4', 'participant', 'Grow through coaching partnerships at work', 'This week''s lesson looks at the coaching relationships that accelerate growth — yours and your colleagues''.', 'Coaching Relationships', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-4-l', 'poea-4', 'leader', 'Grow through coaching partnerships at work', 'This week''s lesson looks at the coaching relationships that accelerate growth — yours and your colleagues''.', 'Coaching Relationships', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('poea-5', 'poea', 'POEA 1.8', 'Comfort Zone', 7, '08:00', 4) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-5-p', 'poea-5', 'participant', 'Decode your Kite Graph and read yourself clearly', 'Before the workshop: learn to read your own Kite Graph and see where your comfort zone has been drawing its borders.', 'Decode Your Kite Graph', 'https://intendrix.ai/posts/know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('poea-5-l', 'poea-5', 'leader', 'Decode your Kite Graph and read yourself clearly', 'Before the workshop: learn to read your own Kite Graph and see where your comfort zone has been drawing its borders.', 'Decode Your Kite Graph', 'https://intendrix.ai/posts/know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly', null, null) on conflict (step_id, variant) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('pwea', 'tle-e', 'PWEA', 'Post-Workshop', 'Leadership', 'workshop', '#cf3352', 1) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pwea-1', 'pwea', 'PWEA 1', 'Habits', 7, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-1-p', 'pwea-1', 'participant', 'Master the small daily habits that reshape your life', 'The workshop was the spark — habits are what keep it burning. This week''s lesson shows how small daily habits reshape your leadership.', 'Master the Small Daily Habits', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-1-l', 'pwea-1', 'leader', 'Master the small daily habits that reshape your life', 'The workshop was the spark — habits are what keep it burning. This week''s lesson shows how small daily habits reshape your leadership.', 'Master the Small Daily Habits', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pwea-2', 'pwea', 'PWEA 2', 'Being Inspirational', 7, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-2-p', 'pwea-2', 'participant', 'Speak a vivid future into being', 'This week: leading from inspiration rather than fear. What future could you describe to your team that would be worth working toward?', 'Speak a Vivid Future Into Being', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-speak-a-vivid-future-into-being', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-2-l', 'pwea-2', 'leader', 'Speak a vivid future into being — plus your Leaders Guides', 'This week: leading from inspiration rather than fear. We suggest you hold a team meeting with your participants in 2 weeks to discuss this lesson and the next two. To prepare, we''ve included your Leaders Guides — your coaching in facilitating discussions that promote personal growth.', 'Speak a Vivid Future Into Being', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-speak-a-vivid-future-into-being', null, 'First send that introduces the Leaders Guide series to the CEO.') on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pwea-2-l-x0', 'pwea-2-l', 'Leaders Guide 02 — Discussion Guide for Any Lesson', 'https://intendrix.ai/posts/basecamp-for-leaders-a-discussion-guide-for-leading-any-and-all-lessons', 0) on conflict (id) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pwea-2-l-x1', 'pwea-2-l', 'Leaders Guide 04 — Your Guide to All the Lessons', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-your-guide-to-all-the-lessons', 1) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pwea-3', 'pwea', 'PWEA 3', 'Your Career Aspirations', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-3-p', 'pwea-3', 'participant', 'Anchor your career in what truly drives you', 'This week''s lesson: what actually drives your career — beneath the job title.', 'Anchor Your Career in What Truly Drives You', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-anchor-your-career-in-what-truly-drives-you', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-3-l', 'pwea-3', 'leader', 'Anchor your career in what truly drives you', 'This week''s lesson: what actually drives your career — beneath the job title. Your Leaders Guide for this conversation is included.', 'Anchor Your Career in What Truly Drives You', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-anchor-your-career-in-what-truly-drives-you', null, null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pwea-3-l-x0', 'pwea-3-l', 'Leaders Guide 03 — Discussions in Action (two-video set)', 'https://intendrix.ai/posts/basecamp-for-leaders-discussions-in-action-a-two-video-set-of-lesson', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pwea-4', 'pwea', 'PWEA 4', 'Leading Your Life at Work', 7, '08:00', 3) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-4-p', 'pwea-4', 'participant', 'Make your organization''s mission your own', 'This week''s lesson connects your personal purpose with the organization''s mission — where the two meet is where leadership gets real.', 'Make Your Organization''s Mission Your Own', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-make-your-organizations-mission-your-own', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-4-l', 'pwea-4', 'leader', 'Make your organization''s mission your own — team meeting week', 'This week''s lesson connects personal purpose with the organization''s mission. Have your team meeting this week — before leading it, see the Leaders Guide ''The Mission is Mine''.', 'Make Your Organization''s Mission Your Own', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-make-your-organizations-mission-your-own', 'Discuss Habits, Being Inspirational, Career Aspirations and The Mission is Mine.', null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pwea-4-l-x0', 'pwea-4-l', 'Leaders Guide — The Mission is Mine', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m2-the-mission-is-mine', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pwea-5', 'pwea', 'PWEA 5', 'Department Purpose', 7, '08:00', 4) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-5-p', 'pwea-5', 'participant', 'Define the contribution your team is here to make', 'This week''s lesson: your department''s purpose — the contribution your team is here to make.', 'Define the Contribution Your Team Is Here to Make', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-define-the-contribution-your-team-is-here-to-make', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pwea-5-l', 'pwea-5', 'leader', 'Define the contribution your team is here to make', 'This week''s lesson: your department''s purpose. Before leading this conversation with your team, see the Leaders Guide ''Purpose of My Job''. Give the team 2 weeks to work on this.', 'Define the Contribution Your Team Is Here to Make', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-define-the-contribution-your-team-is-here-to-make', 'Work session on Department Purpose — give participants 2 weeks to work on it.', null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pwea-5-l-x0', 'pwea-5-l', 'Leaders Guide — Purpose of My Job (S5 M4)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m4-purpose-of-my-job', 0) on conflict (id) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('pcs1', 'tle-e', 'PCS1', 'Post-Coaching Session 1', 'Management', 'coaching1', '#a1348c', 2) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs1-1', 'pcs1', 'PCS1 1', 'Being Your Word', 2, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs1-1-p', 'pcs1-1', 'participant', 'Become someone whose word can be counted on', 'Management starts with integrity. This week''s lesson: being your word.', 'Become Someone Whose Word Can Be Counted On', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-become-someone-whose-word-can-be-counted-on', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs1-1-l', 'pcs1-1', 'leader', 'Become someone whose word can be counted on', 'Management starts with integrity. This week''s lesson: being your word.', 'Become Someone Whose Word Can Be Counted On', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-become-someone-whose-word-can-be-counted-on', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs1-2', 'pcs1', 'PCS1 5.5', 'Being the Guardian of Your Time', 7, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs1-2-p', 'pcs1-2', 'participant', 'Being the guardian of your time', 'This week''s lesson (S4 M5.5): guarding your time like the strategic asset it is.', 'Being the Guardian of Your Time', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-being-the-guardian-of-your-time', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs1-2-l', 'pcs1-2', 'leader', 'Being the guardian of your time', 'This week''s lesson (S4 M5.5): guarding your time like the strategic asset it is.', 'Being the Guardian of Your Time', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-being-the-guardian-of-your-time', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs1-3', 'pcs1', 'PCS1 2', 'Supportive Accountability', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs1-3-p', 'pcs1-3', 'participant', 'Turn accountability into support that drives results', 'This week''s lesson: accountability that supports people instead of policing them.', 'Turn Accountability Into Support That Drives Results', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-turn-accountability-into-support-that-drives-results', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs1-3-l', 'pcs1-3', 'leader', 'Turn accountability into support that drives results', 'This week''s lesson: accountability that supports people instead of policing them. Your Leaders Guide for this conversation is included.', 'Turn Accountability Into Support That Drives Results', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-turn-accountability-into-support-that-drives-results', null, null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pcs1-3-l-x0', 'pcs1-3-l', 'Leaders Guide — Supportive Accountability (S5 M6)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m6-supportive-accountability', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs1-4', 'pcs1', 'PCS1 3', 'Measuring Your Effectiveness', 7, '08:00', 3) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs1-4-p', 'pcs1-4', 'participant', 'Track the impact you''re actually making', 'This week''s lesson: measuring your effectiveness — tracking the impact you''re actually making, not just the activity.', 'Track the Impact You''re Actually Making', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-track-the-impact-youre-actually-making', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs1-4-l', 'pcs1-4', 'leader', 'Track the impact you''re actually making — team meeting week', 'This week''s lesson: measuring your effectiveness. Before leading this conversation, see the Leaders Guide. Then hold your team meeting.', 'Track the Impact You''re Actually Making', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-track-the-impact-youre-actually-making', 'Discuss Supportive Accountability and Measuring Your Effectiveness. Work with participants to develop and agree on measures for their department or unit — 3 weeks to work on this.', null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pcs1-4-l-x0', 'pcs1-4-l', 'Leaders Guide — Measuring Your Effectiveness (S5 M5)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m5-measuring-your-effectiveness', 0) on conflict (id) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('pcs2', 'tle-e', 'PCS2', 'Post-Coaching Session 2', 'Coaching', 'coaching2', '#6531a5', 3) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs2-1', 'pcs2', 'PCS2 1', 'Understanding Your Graph', 2, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-1-p', 'pcs2-1', 'participant', 'Decode your Kite Graph and read yourself clearly', 'The coaching series opens with self-knowledge: decode your Kite Graph and read yourself clearly. In 3 weeks, your leader will host a team meeting on the next three lessons.', 'Decode Your Kite Graph', 'https://intendrix.ai/posts/know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-1-l', 'pcs2-1', 'leader', 'Decode your Kite Graph — plus your Leaders Guide', 'The coaching series opens with self-knowledge. In 3 weeks we suggest you hold a team meeting to discuss the next 3 lessons. Your Leaders Guide ''Understanding Your Graph'' is included.', 'Decode Your Kite Graph', 'https://intendrix.ai/posts/know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly', null, null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pcs2-1-l-x0', 'pcs2-1-l', 'Leaders Guide — Understanding Your Graph (S2 M9)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s2-m9-understanding-your-graph', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs2-2', 'pcs2', 'PCS2 2', 'Being Nurturing', 7, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-2-p', 'pcs2-2', 'participant', 'Coach others into the potential they can''t yet see', 'This week''s lesson: nurturing — coaching people into the potential they can''t yet see in themselves.', 'Coach Others Into the Potential They Can''t Yet See', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-coach-others-into-the-potential-they-cant-yet-see', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-2-l', 'pcs2-2', 'leader', 'Coach others into the potential they can''t yet see', 'This week''s lesson: nurturing — coaching people into the potential they can''t yet see in themselves.', 'Coach Others Into the Potential They Can''t Yet See', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-coach-others-into-the-potential-they-cant-yet-see', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs2-3', 'pcs2', 'PCS2 3', 'Being Attentive', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-3-p', 'pcs2-3', 'participant', 'Hold your full presence in every conversation', 'This week''s lesson: attentiveness — holding your full presence in every conversation.', 'Hold Your Full Presence in Every Conversation', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-hold-your-full-presence-in-every-conversation', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-3-l', 'pcs2-3', 'leader', 'Hold your full presence in every conversation', 'This week''s lesson: attentiveness — holding your full presence in every conversation.', 'Hold Your Full Presence in Every Conversation', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-hold-your-full-presence-in-every-conversation', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs2-4', 'pcs2', 'PCS2 4', 'Coaching Relationships', 7, '08:00', 3) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-4-p', 'pcs2-4', 'participant', 'Grow through coaching partnerships at work', 'This week''s lesson: building coaching relationships across your team.', 'Coaching Relationships', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-4-l', 'pcs2-4', 'leader', 'Grow through coaching partnerships — team meeting week', 'This week''s lesson: building coaching relationships. Before leading this with your people, see the Leaders Guide ''Developing Coaching Relationships''. Then hold your team meeting.', 'Coaching Relationships', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work', 'Discuss lessons 2–4 and progress on participants coaching their team members. Give participants 3 weeks to complete coaching with their team.', null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('pcs2-4-l-x0', 'pcs2-4-l', 'Leaders Guide — Developing Coaching Relationships (S5 M7)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m7-developing-coaching-relationships', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pcs2-5', 'pcs2', 'PCS2 5', 'Being Impactful', 7, '08:00', 4) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-5-p', 'pcs2-5', 'participant', 'Being impactful', 'This week''s lesson (S4 M6.5): being impactful.', 'Being Impactful (S4 M6.5)', null, null, 'Lesson link missing in the source document — to be added.') on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pcs2-5-l', 'pcs2-5', 'leader', 'Being impactful', 'This week''s lesson (S4 M6.5): being impactful.', 'Being Impactful (S4 M6.5)', null, null, 'Lesson link missing in the source document — to be added.') on conflict (step_id, variant) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('pls', 'tle-e', 'PLS', 'Post-Launch', 'Integrated life & lasting habits', 'launch', '#2c2d83', 4) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pls-1', 'pls', 'PLS 1', 'Integrated Life', 7, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pls-1-p', 'pls-1', 'participant', 'Integrate every area of your life into one whole', 'The program is launched — now for life beyond it. This week''s lesson: the integrated life.', 'Integrate Every Area of Your Life Into One Whole', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-integrate-every-area-of-your-life-into-one-whole', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pls-1-l', 'pls-1', 'leader', 'Integrate every area of your life into one whole', 'The program is launched — now for life beyond it. This week''s lesson: the integrated life.', 'Integrate Every Area of Your Life Into One Whole', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-integrate-every-area-of-your-life-into-one-whole', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pls-2', 'pls', 'PLS 2', 'Integrated Life Design', 7, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pls-2-p', 'pls-2', 'participant', 'Designing your integrated life', 'This week''s lesson: designing your integrated life — turning the vision into a design you live by.', 'Designing Your Integrated Life', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-designing-your-integrated-life', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pls-2-l', 'pls-2', 'leader', 'Designing your integrated life', 'This week''s lesson: designing your integrated life — turning the vision into a design you live by.', 'Designing Your Integrated Life', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-designing-your-integrated-life', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('pls-3', 'pls', 'PLS 3', 'Your Habits', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pls-3-p', 'pls-3', 'participant', 'The choice is yours', 'The habits you create from this six-month experience will determine whether this work makes lasting value that continues to change your culture — or becomes a wonderful experience you look back on fondly, but that makes little difference. The choice is yours.', 'Master the Small Daily Habits', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life', null, 'May become an email-only send or a closing video — to decide.') on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('pls-3-l', 'pls-3', 'leader', 'The choice is yours', 'The habits you create from this six-month experience will determine whether this work makes lasting value that continues to change your culture — or becomes a wonderful experience you look back on fondly, but that makes little difference. The choice is yours.', 'Master the Small Daily Habits', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life', null, 'May become an email-only send or a closing video — to decide.') on conflict (step_id, variant) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('l-poea', 'tle-l', 'POEA', 'Post-Orientation', 'Getting started & personal mastery', 'orientation', '#eb320f', 5) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-poea-1', 'l-poea', 'POEA 1.2', 'Welcome & Getting Started', 1, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-1-p', 'l-poea-1', 'participant', 'Welcome to Intendrix — your journey starts now', 'Welcome aboard! In this short video Amber walks you through the logistics: how the lessons arrive, the survey process, and your first homework — go to the New Member Guide in Intendrix and complete your profile.', 'New Member Guide', 'https://intendrix.ai/spaces/22388417/content', null, 'Video pending: Amber re-records the original welcome (no Tom & Brad mention, new survey process, new homework assignment).') on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-1-l', 'l-poea-1', 'leader', 'Welcome to Intendrix — your journey starts now', 'Welcome aboard! In this short video Amber walks you through the logistics: how the lessons arrive, the survey process, and your first homework — go to the New Member Guide in Intendrix and complete your profile.', 'New Member Guide', 'https://intendrix.ai/spaces/22388417/content', null, 'Video pending: Amber re-records the original welcome (no Tom & Brad mention, new survey process, new homework assignment).') on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-poea-2', 'l-poea', 'POEA 1.4', 'Personal Mastery', 2, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-2-p', 'l-poea-2', 'participant', 'Start living by design, not default', 'Your first lesson is here. Personal Mastery is the foundation everything else builds on — take 15 minutes this week to go through it.', 'Personal Mastery', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-start-living-by-design-not-default', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-2-l', 'l-poea-2', 'leader', 'Start living by design, not default', 'Your first lesson is here. Personal Mastery is the foundation everything else builds on — take 15 minutes this week to go through it.', 'Personal Mastery', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-start-living-by-design-not-default', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-poea-3', 'l-poea', 'POEA 1.6', 'Growth Mindset', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-3-p', 'l-poea-3', 'participant', 'Prove to yourself that you are not fixed', 'This week''s lesson: Growth Mindset. Discover how much of what feels fixed about you is actually up for design.', 'Growth Mindset', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-prove-to-yourself-that-you-are-not-fixed', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-3-l', 'l-poea-3', 'leader', 'Prove to yourself that you are not fixed', 'This week''s lesson: Growth Mindset. Discover how much of what feels fixed about you is actually up for design.', 'Growth Mindset', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-prove-to-yourself-that-you-are-not-fixed', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-poea-4', 'l-poea', 'POEA 1.7', 'Coaching Relationships', 7, '08:00', 3) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-4-p', 'l-poea-4', 'participant', 'Grow through coaching partnerships at work', 'This week''s lesson looks at the coaching relationships that accelerate growth — yours and your colleagues''.', 'Coaching Relationships', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-4-l', 'l-poea-4', 'leader', 'Grow through coaching partnerships at work', 'This week''s lesson looks at the coaching relationships that accelerate growth — yours and your colleagues''.', 'Coaching Relationships', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-poea-5', 'l-poea', 'POEA 1.8', 'Comfort Zone', 7, '08:00', 4) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-5-p', 'l-poea-5', 'participant', 'Decode your Kite Graph and read yourself clearly', 'Before the workshop: learn to read your own Kite Graph and see where your comfort zone has been drawing its borders.', 'Decode Your Kite Graph', 'https://intendrix.ai/posts/know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-poea-5-l', 'l-poea-5', 'leader', 'Decode your Kite Graph and read yourself clearly', 'Before the workshop: learn to read your own Kite Graph and see where your comfort zone has been drawing its borders.', 'Decode Your Kite Graph', 'https://intendrix.ai/posts/know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly', null, null) on conflict (step_id, variant) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('l-pwea', 'tle-l', 'PWEA', 'Post-Workshop', 'Leadership', 'workshop', '#cf3352', 6) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pwea-1', 'l-pwea', 'PWEA 1', 'Habits', 7, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-1-p', 'l-pwea-1', 'participant', 'Master the small daily habits that reshape your life', 'The workshop was the spark — habits are what keep it burning. This week''s lesson shows how small daily habits reshape your leadership.', 'Master the Small Daily Habits', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-1-l', 'l-pwea-1', 'leader', 'Master the small daily habits that reshape your life', 'The workshop was the spark — habits are what keep it burning. This week''s lesson shows how small daily habits reshape your leadership.', 'Master the Small Daily Habits', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pwea-2', 'l-pwea', 'PWEA 2', 'Being Inspirational', 7, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-2-p', 'l-pwea-2', 'participant', 'Speak a vivid future into being', 'This week: leading from inspiration rather than fear. What future could you describe to your team that would be worth working toward?', 'Speak a Vivid Future Into Being', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-speak-a-vivid-future-into-being', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-2-l', 'l-pwea-2', 'leader', 'Speak a vivid future into being — plus your Leaders Guides', 'This week: leading from inspiration rather than fear. We suggest you hold a team meeting with your participants in 2 weeks to discuss this lesson and the next two. To prepare, we''ve included your Leaders Guides — your coaching in facilitating discussions that promote personal growth.', 'Speak a Vivid Future Into Being', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-speak-a-vivid-future-into-being', null, 'First send that introduces the Leaders Guide series to the CEO.') on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pwea-2-l-x0', 'l-pwea-2-l', 'Leaders Guide 02 — Discussion Guide for Any Lesson', 'https://intendrix.ai/posts/basecamp-for-leaders-a-discussion-guide-for-leading-any-and-all-lessons', 0) on conflict (id) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pwea-2-l-x1', 'l-pwea-2-l', 'Leaders Guide 04 — Your Guide to All the Lessons', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-your-guide-to-all-the-lessons', 1) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pwea-3', 'l-pwea', 'PWEA 3', 'Your Career Aspirations', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-3-p', 'l-pwea-3', 'participant', 'Anchor your career in what truly drives you', 'This week''s lesson: what actually drives your career — beneath the job title.', 'Anchor Your Career in What Truly Drives You', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-anchor-your-career-in-what-truly-drives-you', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-3-l', 'l-pwea-3', 'leader', 'Anchor your career in what truly drives you', 'This week''s lesson: what actually drives your career — beneath the job title. Your Leaders Guide for this conversation is included.', 'Anchor Your Career in What Truly Drives You', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-anchor-your-career-in-what-truly-drives-you', null, null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pwea-3-l-x0', 'l-pwea-3-l', 'Leaders Guide 03 — Discussions in Action (two-video set)', 'https://intendrix.ai/posts/basecamp-for-leaders-discussions-in-action-a-two-video-set-of-lesson', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pwea-4', 'l-pwea', 'PWEA 4', 'Leading Your Life at Work', 7, '08:00', 3) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-4-p', 'l-pwea-4', 'participant', 'Make your organization''s mission your own', 'This week''s lesson connects your personal purpose with the organization''s mission — where the two meet is where leadership gets real.', 'Make Your Organization''s Mission Your Own', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-make-your-organizations-mission-your-own', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-4-l', 'l-pwea-4', 'leader', 'Make your organization''s mission your own — team meeting week', 'This week''s lesson connects personal purpose with the organization''s mission. Have your team meeting this week — before leading it, see the Leaders Guide ''The Mission is Mine''.', 'Make Your Organization''s Mission Your Own', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-make-your-organizations-mission-your-own', 'Discuss Habits, Being Inspirational, Career Aspirations and The Mission is Mine.', null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pwea-4-l-x0', 'l-pwea-4-l', 'Leaders Guide — The Mission is Mine', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m2-the-mission-is-mine', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pwea-5', 'l-pwea', 'PWEA 5', 'Department Purpose', 7, '08:00', 4) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-5-p', 'l-pwea-5', 'participant', 'Define the contribution your team is here to make', 'This week''s lesson: your department''s purpose — the contribution your team is here to make.', 'Define the Contribution Your Team Is Here to Make', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-define-the-contribution-your-team-is-here-to-make', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pwea-5-l', 'l-pwea-5', 'leader', 'Define the contribution your team is here to make', 'This week''s lesson: your department''s purpose. Before leading this conversation with your team, see the Leaders Guide ''Purpose of My Job''. Give the team 2 weeks to work on this.', 'Define the Contribution Your Team Is Here to Make', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-define-the-contribution-your-team-is-here-to-make', 'Work session on Department Purpose — give participants 2 weeks to work on it.', null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pwea-5-l-x0', 'l-pwea-5-l', 'Leaders Guide — Purpose of My Job (S5 M4)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m4-purpose-of-my-job', 0) on conflict (id) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('l-pcs1', 'tle-l', 'PCS1', 'Post-Coaching Session 1', 'Management', 'coaching1', '#a1348c', 7) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs1-1', 'l-pcs1', 'PCS1 1', 'Being Your Word', 2, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs1-1-p', 'l-pcs1-1', 'participant', 'Become someone whose word can be counted on', 'Management starts with integrity. This week''s lesson: being your word.', 'Become Someone Whose Word Can Be Counted On', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-become-someone-whose-word-can-be-counted-on', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs1-1-l', 'l-pcs1-1', 'leader', 'Become someone whose word can be counted on', 'Management starts with integrity. This week''s lesson: being your word.', 'Become Someone Whose Word Can Be Counted On', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-become-someone-whose-word-can-be-counted-on', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs1-2', 'l-pcs1', 'PCS1 5.5', 'Being the Guardian of Your Time', 7, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs1-2-p', 'l-pcs1-2', 'participant', 'Being the guardian of your time', 'This week''s lesson (S4 M5.5): guarding your time like the strategic asset it is.', 'Being the Guardian of Your Time', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-being-the-guardian-of-your-time', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs1-2-l', 'l-pcs1-2', 'leader', 'Being the guardian of your time', 'This week''s lesson (S4 M5.5): guarding your time like the strategic asset it is.', 'Being the Guardian of Your Time', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-being-the-guardian-of-your-time', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs1-3', 'l-pcs1', 'PCS1 2', 'Supportive Accountability', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs1-3-p', 'l-pcs1-3', 'participant', 'Turn accountability into support that drives results', 'This week''s lesson: accountability that supports people instead of policing them.', 'Turn Accountability Into Support That Drives Results', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-turn-accountability-into-support-that-drives-results', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs1-3-l', 'l-pcs1-3', 'leader', 'Turn accountability into support that drives results', 'This week''s lesson: accountability that supports people instead of policing them. Your Leaders Guide for this conversation is included.', 'Turn Accountability Into Support That Drives Results', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-turn-accountability-into-support-that-drives-results', null, null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pcs1-3-l-x0', 'l-pcs1-3-l', 'Leaders Guide — Supportive Accountability (S5 M6)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m6-supportive-accountability', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs1-4', 'l-pcs1', 'PCS1 3', 'Measuring Your Effectiveness', 7, '08:00', 3) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs1-4-p', 'l-pcs1-4', 'participant', 'Track the impact you''re actually making', 'This week''s lesson: measuring your effectiveness — tracking the impact you''re actually making, not just the activity.', 'Track the Impact You''re Actually Making', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-track-the-impact-youre-actually-making', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs1-4-l', 'l-pcs1-4', 'leader', 'Track the impact you''re actually making — team meeting week', 'This week''s lesson: measuring your effectiveness. Before leading this conversation, see the Leaders Guide. Then hold your team meeting.', 'Track the Impact You''re Actually Making', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-track-the-impact-youre-actually-making', 'Discuss Supportive Accountability and Measuring Your Effectiveness. Work with participants to develop and agree on measures for their department or unit — 3 weeks to work on this.', null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pcs1-4-l-x0', 'l-pcs1-4-l', 'Leaders Guide — Measuring Your Effectiveness (S5 M5)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m5-measuring-your-effectiveness', 0) on conflict (id) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('l-pcs2', 'tle-l', 'PCS2', 'Post-Coaching Session 2', 'Coaching', 'coaching2', '#6531a5', 8) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs2-1', 'l-pcs2', 'PCS2 1', 'Understanding Your Graph', 2, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-1-p', 'l-pcs2-1', 'participant', 'Decode your Kite Graph and read yourself clearly', 'The coaching series opens with self-knowledge: decode your Kite Graph and read yourself clearly. In 3 weeks, your leader will host a team meeting on the next three lessons.', 'Decode Your Kite Graph', 'https://intendrix.ai/posts/know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-1-l', 'l-pcs2-1', 'leader', 'Decode your Kite Graph — plus your Leaders Guide', 'The coaching series opens with self-knowledge. In 3 weeks we suggest you hold a team meeting to discuss the next 3 lessons. Your Leaders Guide ''Understanding Your Graph'' is included.', 'Decode Your Kite Graph', 'https://intendrix.ai/posts/know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly', null, null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pcs2-1-l-x0', 'l-pcs2-1-l', 'Leaders Guide — Understanding Your Graph (S2 M9)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s2-m9-understanding-your-graph', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs2-2', 'l-pcs2', 'PCS2 2', 'Being Nurturing', 7, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-2-p', 'l-pcs2-2', 'participant', 'Coach others into the potential they can''t yet see', 'This week''s lesson: nurturing — coaching people into the potential they can''t yet see in themselves.', 'Coach Others Into the Potential They Can''t Yet See', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-coach-others-into-the-potential-they-cant-yet-see', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-2-l', 'l-pcs2-2', 'leader', 'Coach others into the potential they can''t yet see', 'This week''s lesson: nurturing — coaching people into the potential they can''t yet see in themselves.', 'Coach Others Into the Potential They Can''t Yet See', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-coach-others-into-the-potential-they-cant-yet-see', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs2-3', 'l-pcs2', 'PCS2 3', 'Being Attentive', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-3-p', 'l-pcs2-3', 'participant', 'Hold your full presence in every conversation', 'This week''s lesson: attentiveness — holding your full presence in every conversation.', 'Hold Your Full Presence in Every Conversation', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-hold-your-full-presence-in-every-conversation', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-3-l', 'l-pcs2-3', 'leader', 'Hold your full presence in every conversation', 'This week''s lesson: attentiveness — holding your full presence in every conversation.', 'Hold Your Full Presence in Every Conversation', 'https://intendrix.ai/posts/be-your-purpose-%E2%9E%BD-hold-your-full-presence-in-every-conversation', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs2-4', 'l-pcs2', 'PCS2 4', 'Coaching Relationships', 7, '08:00', 3) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-4-p', 'l-pcs2-4', 'participant', 'Grow through coaching partnerships at work', 'This week''s lesson: building coaching relationships across your team.', 'Coaching Relationships', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-4-l', 'l-pcs2-4', 'leader', 'Grow through coaching partnerships — team meeting week', 'This week''s lesson: building coaching relationships. Before leading this with your people, see the Leaders Guide ''Developing Coaching Relationships''. Then hold your team meeting.', 'Coaching Relationships', 'https://intendrix.ai/posts/career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work', 'Discuss lessons 2–4 and progress on participants coaching their team members. Give participants 3 weeks to complete coaching with their team.', null) on conflict (step_id, variant) do nothing;
insert into step_links (id, step_content_id, label, url, sort_order) values ('l-pcs2-4-l-x0', 'l-pcs2-4-l', 'Leaders Guide — Developing Coaching Relationships (S5 M7)', 'https://intendrix.ai/posts/basecamp-for-leaders-leaders-guide-lesson-s5-m7-developing-coaching-relationships', 0) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pcs2-5', 'l-pcs2', 'PCS2 5', 'Being Impactful', 7, '08:00', 4) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-5-p', 'l-pcs2-5', 'participant', 'Being impactful', 'This week''s lesson (S4 M6.5): being impactful.', 'Being Impactful (S4 M6.5)', null, null, 'Lesson link missing in the source document — to be added.') on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pcs2-5-l', 'l-pcs2-5', 'leader', 'Being impactful', 'This week''s lesson (S4 M6.5): being impactful.', 'Being Impactful (S4 M6.5)', null, null, 'Lesson link missing in the source document — to be added.') on conflict (step_id, variant) do nothing;
insert into series_templates (id, campaign_template_id, code, name, focus, trigger_kind, color, sort_order) values ('l-pls', 'tle-l', 'PLS', 'Post-Launch', 'Integrated life & lasting habits', 'launch', '#2c2d83', 9) on conflict (id) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pls-1', 'l-pls', 'PLS 1', 'Integrated Life', 7, '08:00', 0) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pls-1-p', 'l-pls-1', 'participant', 'Integrate every area of your life into one whole', 'The program is launched — now for life beyond it. This week''s lesson: the integrated life.', 'Integrate Every Area of Your Life Into One Whole', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-integrate-every-area-of-your-life-into-one-whole', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pls-1-l', 'l-pls-1', 'leader', 'Integrate every area of your life into one whole', 'The program is launched — now for life beyond it. This week''s lesson: the integrated life.', 'Integrate Every Area of Your Life Into One Whole', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-integrate-every-area-of-your-life-into-one-whole', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pls-2', 'l-pls', 'PLS 2', 'Integrated Life Design', 7, '08:00', 1) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pls-2-p', 'l-pls-2', 'participant', 'Designing your integrated life', 'This week''s lesson: designing your integrated life — turning the vision into a design you live by.', 'Designing Your Integrated Life', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-designing-your-integrated-life', null, null) on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pls-2-l', 'l-pls-2', 'leader', 'Designing your integrated life', 'This week''s lesson: designing your integrated life — turning the vision into a design you live by.', 'Designing Your Integrated Life', 'https://intendrix.ai/posts/design-your-life-%E2%9E%BD-designing-your-integrated-life', null, null) on conflict (step_id, variant) do nothing;
insert into series_steps (id, series_template_id, code, title, offset_days, send_time, sort_order) values ('l-pls-3', 'l-pls', 'PLS 3', 'Your Habits', 7, '08:00', 2) on conflict (id) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pls-3-p', 'l-pls-3', 'participant', 'The choice is yours', 'The habits you create from this six-month experience will determine whether this work makes lasting value that continues to change your culture — or becomes a wonderful experience you look back on fondly, but that makes little difference. The choice is yours.', 'Master the Small Daily Habits', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life', null, 'May become an email-only send or a closing video — to decide.') on conflict (step_id, variant) do nothing;
insert into step_contents (id, step_id, variant, email_subject, email_body, lesson_label, lesson_url, team_meeting, note) values ('l-pls-3-l', 'l-pls-3', 'leader', 'The choice is yours', 'The habits you create from this six-month experience will determine whether this work makes lasting value that continues to change your culture — or becomes a wonderful experience you look back on fondly, but that makes little difference. The choice is yours.', 'Master the Small Daily Habits', 'https://intendrix.ai/posts/start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life', null, 'May become an email-only send or a closing video — to decide.') on conflict (step_id, variant) do nothing;

-- clients, members, campaigns
insert into clients (id, name, short_name, location, sector, status, phoenix_leader_id, phoenix_coach_id, project_manager_id, space_url, invite_url) values ('caresouth', 'CareSouth Carolina', 'CareSouth', 'South Carolina, USA', 'Community healthcare', 'active', 'brad', 'amber', 'amber', '', '') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m1', 'caresouth', 'Ann Lewis', 'ann.lewis@caresouth.example', 'leader', 'CEO') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m2', 'caresouth', 'Joy Gandy', 'joy.gandy@caresouth.example', 'participant', 'Director of Nursing') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m3', 'caresouth', 'Marcus Reed', 'marcus.reed@caresouth.example', 'participant', 'COO') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m4', 'caresouth', 'Dana Whitfield', 'dana.whitfield@caresouth.example', 'participant', 'CFO') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m5', 'caresouth', 'Sam Okafor', 'sam.okafor@caresouth.example', 'participant', 'CMO') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m6', 'caresouth', 'Rachel Nguyen', 'rachel.nguyen@caresouth.example', 'participant', 'VP Human Resources') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m7', 'caresouth', 'Tom Delaney', 'tom.delaney@caresouth.example', 'participant', 'VP Operations') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m8', 'caresouth', 'Keisha Brown', 'keisha.brown@caresouth.example', 'participant', 'Director of Quality') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m9', 'caresouth', 'Luis Herrera', 'luis.herrera@caresouth.example', 'participant', 'Director of Pharmacy') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m10', 'caresouth', 'Emily Sanders', 'emily.sanders@caresouth.example', 'participant', 'Director of Behavioral Health') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m11', 'caresouth', 'Grant Mitchell', 'grant.mitchell@caresouth.example', 'participant', 'Director of IT') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m12', 'caresouth', 'Priya Patel', 'priya.patel@caresouth.example', 'participant', 'Medical Director') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m13', 'caresouth', 'Carla Jenkins', 'carla.jenkins@caresouth.example', 'participant', 'Director of Dental Services') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m14', 'caresouth', 'Steve Aldridge', 'steve.aldridge@caresouth.example', 'participant', 'Facilities Director') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m15', 'caresouth', 'Monique Davis', 'monique.davis@caresouth.example', 'participant', 'Director of Outreach') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m16', 'caresouth', 'Hannah Kim', 'hannah.kim@caresouth.example', 'participant', 'Compliance Officer') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m17', 'caresouth', 'Derek Foster', 'derek.foster@caresouth.example', 'participant', 'Director of Finance') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m18', 'caresouth', 'Alicia Gomez', 'alicia.gomez@caresouth.example', 'participant', 'Patient Services Director') on conflict (id) do nothing;
insert into members (id, client_id, name, email, role, title) values ('cs-m19', 'caresouth', 'Bill Turner', 'bill.turner@caresouth.example', 'participant', 'Development Director') on conflict (id) do nothing;
insert into campaigns (id, client_id, template_id, code, name, timezone, status_override, start_date, end_date) values ('caresouth-tle-e', 'caresouth', 'tle-e', 'TLE-E', 'TLE for Executives', 'America/New_York', null, '2026-08-05', '2027-02-03') on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('cs-s1', 'caresouth-tle-e', 'Orientation Session', '2026-08-05', 'virtual', 'orientation', 0) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('cs-s2', 'caresouth-tle-e', 'Workshop', '2026-09-16', 'in-person', 'workshop', 1) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('cs-s3', 'caresouth-tle-e', 'Coaching Session 1 · Management', null, 'virtual', 'coaching1', 2) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('cs-s4', 'caresouth-tle-e', 'Coaching Session 2 · Coaching', null, 'in-person', 'coaching2', 3) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('cs-s5', 'caresouth-tle-e', 'Launch Session', null, 'virtual', 'launch', 4) on conflict (id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('caresouth-tle-e-poea', 'caresouth-tle-e', 'poea', 'cs-s1', 0) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('caresouth-tle-e-pwea', 'caresouth-tle-e', 'pwea', 'cs-s2', 1) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('caresouth-tle-e-pcs1', 'caresouth-tle-e', 'pcs1', 'cs-s3', 2) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('caresouth-tle-e-pcs2', 'caresouth-tle-e', 'pcs2', 'cs-s4', 3) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('caresouth-tle-e-pls', 'caresouth-tle-e', 'pls', 'cs-s5', 4) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_client_assignments (id, campaign_id, member_id, role) values ('cs-ca-1', 'caresouth-tle-e', 'cs-m1', 'champion') on conflict (id) do nothing;
insert into clients (id, name, short_name, location, sector, status, phoenix_leader_id, phoenix_coach_id, project_manager_id, space_url, invite_url) values ('brio', 'Brio Living Services', 'Brio', 'Michigan, USA', 'Senior living services', 'active', 'brad', 'amber', null, null, null) on conflict (id) do nothing;
insert into campaigns (id, client_id, template_id, code, name, timezone, status_override, start_date, end_date) values ('brio-tle-e', 'brio', 'tle-e', 'TLE-E', 'TLE for Executives', 'America/New_York', null, null, null) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('br-s1', 'brio-tle-e', 'Orientation Session', null, 'virtual', 'orientation', 0) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('br-s2', 'brio-tle-e', 'Workshop', null, 'in-person', 'workshop', 1) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('br-s3', 'brio-tle-e', 'Coaching Session 1 · Management', null, 'virtual', 'coaching1', 2) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('br-s4', 'brio-tle-e', 'Coaching Session 2 · Coaching', null, 'in-person', 'coaching2', 3) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('br-s5', 'brio-tle-e', 'Launch Session', null, 'virtual', 'launch', 4) on conflict (id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('brio-tle-e-poea', 'brio-tle-e', 'poea', 'br-s1', 0) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('brio-tle-e-pwea', 'brio-tle-e', 'pwea', 'br-s2', 1) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('brio-tle-e-pcs1', 'brio-tle-e', 'pcs1', 'br-s3', 2) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('brio-tle-e-pcs2', 'brio-tle-e', 'pcs2', 'br-s4', 3) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('brio-tle-e-pls', 'brio-tle-e', 'pls', 'br-s5', 4) on conflict (campaign_id, series_template_id) do nothing;
insert into clients (id, name, short_name, location, sector, status, phoenix_leader_id, phoenix_coach_id, project_manager_id, space_url, invite_url) values ('merit', 'Merit', 'Merit', 'USA', '—', 'active', 'kevin', 'amber', null, null, null) on conflict (id) do nothing;
insert into campaigns (id, client_id, template_id, code, name, timezone, status_override, start_date, end_date) values ('merit-tle-e', 'merit', 'tle-e', 'TLE-E', 'TLE for Executives', 'America/New_York', null, null, null) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('me-s1', 'merit-tle-e', 'Orientation Session', null, 'virtual', 'orientation', 0) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('me-s2', 'merit-tle-e', 'Workshop', null, 'in-person', 'workshop', 1) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('me-s3', 'merit-tle-e', 'Coaching Session 1 · Management', null, 'virtual', 'coaching1', 2) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('me-s4', 'merit-tle-e', 'Coaching Session 2 · Coaching', null, 'in-person', 'coaching2', 3) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('me-s5', 'merit-tle-e', 'Launch Session', null, 'virtual', 'launch', 4) on conflict (id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('merit-tle-e-poea', 'merit-tle-e', 'poea', 'me-s1', 0) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('merit-tle-e-pwea', 'merit-tle-e', 'pwea', 'me-s2', 1) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('merit-tle-e-pcs1', 'merit-tle-e', 'pcs1', 'me-s3', 2) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('merit-tle-e-pcs2', 'merit-tle-e', 'pcs2', 'me-s4', 3) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('merit-tle-e-pls', 'merit-tle-e', 'pls', 'me-s5', 4) on conflict (campaign_id, series_template_id) do nothing;
insert into clients (id, name, short_name, location, sector, status, phoenix_leader_id, phoenix_coach_id, project_manager_id, space_url, invite_url) values ('tlc-academy', 'The Learning Choice Academy', 'TLC Academy', 'California, USA', 'Education', 'active', 'brad', 'giulia', null, null, null) on conflict (id) do nothing;
insert into campaigns (id, client_id, template_id, code, name, timezone, status_override, start_date, end_date) values ('tlc-tle-e', 'tlc-academy', 'tle-e', 'TLE-E', 'TLE for Executives', 'America/Los_Angeles', null, null, null) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('tl-s1', 'tlc-tle-e', 'Orientation Session', null, 'virtual', 'orientation', 0) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('tl-s2', 'tlc-tle-e', 'Workshop', null, 'in-person', 'workshop', 1) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('tl-s3', 'tlc-tle-e', 'Coaching Session 1 · Management', null, 'virtual', 'coaching1', 2) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('tl-s4', 'tlc-tle-e', 'Coaching Session 2 · Coaching', null, 'in-person', 'coaching2', 3) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('tl-s5', 'tlc-tle-e', 'Launch Session', null, 'virtual', 'launch', 4) on conflict (id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('tlc-tle-e-poea', 'tlc-tle-e', 'poea', 'tl-s1', 0) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('tlc-tle-e-pwea', 'tlc-tle-e', 'pwea', 'tl-s2', 1) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('tlc-tle-e-pcs1', 'tlc-tle-e', 'pcs1', 'tl-s3', 2) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('tlc-tle-e-pcs2', 'tlc-tle-e', 'pcs2', 'tl-s4', 3) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('tlc-tle-e-pls', 'tlc-tle-e', 'pls', 'tl-s5', 4) on conflict (campaign_id, series_template_id) do nothing;
insert into clients (id, name, short_name, location, sector, status, phoenix_leader_id, phoenix_coach_id, project_manager_id, space_url, invite_url) values ('zumbro', 'Zumbro Valley', 'Zumbro', 'Minnesota, USA', 'Community health', 'active', 'kevin', 'giulia', null, null, null) on conflict (id) do nothing;
insert into campaigns (id, client_id, template_id, code, name, timezone, status_override, start_date, end_date) values ('zumbro-tle-e', 'zumbro', 'tle-e', 'TLE-E', 'TLE for Executives', 'America/Chicago', null, null, null) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('zv-s1', 'zumbro-tle-e', 'Orientation Session', null, 'virtual', 'orientation', 0) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('zv-s2', 'zumbro-tle-e', 'Workshop', null, 'in-person', 'workshop', 1) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('zv-s3', 'zumbro-tle-e', 'Coaching Session 1 · Management', null, 'virtual', 'coaching1', 2) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('zv-s4', 'zumbro-tle-e', 'Coaching Session 2 · Coaching', null, 'in-person', 'coaching2', 3) on conflict (id) do nothing;
insert into campaign_sessions (id, campaign_id, name, session_date, mode, kind, sort_order) values ('zv-s5', 'zumbro-tle-e', 'Launch Session', null, 'virtual', 'launch', 4) on conflict (id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('zumbro-tle-e-poea', 'zumbro-tle-e', 'poea', 'zv-s1', 0) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('zumbro-tle-e-pwea', 'zumbro-tle-e', 'pwea', 'zv-s2', 1) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('zumbro-tle-e-pcs1', 'zumbro-tle-e', 'pcs1', 'zv-s3', 2) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('zumbro-tle-e-pcs2', 'zumbro-tle-e', 'pcs2', 'zv-s4', 3) on conflict (campaign_id, series_template_id) do nothing;
insert into campaign_series (id, campaign_id, series_template_id, trigger_session_id, sort_order) values ('zumbro-tle-e-pls', 'zumbro-tle-e', 'pls', 'zv-s5', 4) on conflict (campaign_id, series_template_id) do nothing;
