-- Intendrix — one email, its own date
--
-- The schedule normally computes every send date from the trigger
-- session plus working-day offsets. A row here pins ONE lesson of ONE
-- campaign to a date chosen by hand. Only that email moves: the rest of
-- the series keeps its automatic chain, and deleting the row returns
-- the email to the automatic date. The engine reads this table too, so
-- what the app shows is what the engine does.

create table if not exists campaign_step_dates (
  campaign_id text not null references campaigns (id) on delete cascade,
  step_id     text not null references series_steps (id) on delete cascade,
  send_on     date not null,
  created_at  timestamptz not null default now(),
  primary key (campaign_id, step_id)
);

comment on table campaign_step_dates is
  'Hand-picked send dates, per campaign and lesson. A row overrides the computed date for exactly that email.';

alter table campaign_step_dates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'campaign_step_dates'
       and policyname = 'campaign_step_dates_team_all'
  ) then
    create policy campaign_step_dates_team_all on campaign_step_dates
      for all to authenticated using (true) with check (true);
  end if;
end $$;
