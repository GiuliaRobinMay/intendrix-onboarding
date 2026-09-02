-- Intendrix — a campaign can word its own emails
--
-- The lesson library is the master. Editing an email inside a campaign's
-- mailbox must not rewrite that master: the change lands here instead,
-- keyed to the one campaign, and wins over the master wording for that
-- campaign only. A missing row (or a missing field) falls back to the
-- master, so the library remains the single place the programme is
-- designed and the campaign remains free to speak in its own words.

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
