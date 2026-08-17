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
