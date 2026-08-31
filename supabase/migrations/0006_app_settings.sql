-- Intendrix — one place for the handful of app-wide values
--
-- First occupant: the company logo that closes every lesson email. The
-- signature text lives per person on staff; the logo is one image for
-- the whole team, so it belongs to the app, not to a row in staff.
--
-- Key-value on purpose: the next app-wide value (a sending address, a
-- default timezone) is a row here, not a migration.

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
