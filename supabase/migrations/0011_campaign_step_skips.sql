-- Intendrix — cancel one lesson email for one campaign
--
-- A row here means: this campaign never sends this lesson. The lesson
-- stays visible in the mailbox and on the campaign page with the status
-- Cancelled; deleting the row restores it. The engine checks this table
-- before every send.

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
