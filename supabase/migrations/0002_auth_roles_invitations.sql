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
