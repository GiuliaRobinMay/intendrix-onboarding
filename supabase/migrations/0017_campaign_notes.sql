-- Intendrix — what the team wants to remember about a campaign
--
-- Not a field on the campaign, because this is a running record: what
-- was done, what the client asked for, what to watch out for next
-- time. Every entry keeps who wrote it and when, so the newest is on
-- top and nothing overwrites anything.

create table if not exists campaign_notes (
  id          text primary key default gen_random_uuid()::text,
  campaign_id text not null references campaigns (id) on delete cascade,
  body        text not null,
  author      text,
  created_at  timestamptz not null default now()
);

create index if not exists campaign_notes_campaign_idx
  on campaign_notes (campaign_id, created_at desc);

comment on table campaign_notes is
  'Free notes the team keeps on a campaign — newest first, never overwritten.';
comment on column campaign_notes.author is
  'Who wrote it, as a name — kept even if that person later leaves.';
