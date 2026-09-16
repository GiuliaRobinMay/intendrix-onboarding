-- Intendrix — people come and go, and things worth remembering about them
--
-- A member who leaves the team is not deleted: their record, and
-- everything they were ever sent, stays. They simply become inactive,
-- and every send — the daily engine, Send now, the agreement and the
-- community invitation — skips them from that moment on.
--
-- The note is for whatever the team needs to remember about a person:
-- "on maternity leave until March", "prefers her gmail", "new in role".

alter table members add column if not exists status  text not null default 'active';
alter table members add column if not exists note    text;
alter table members add column if not exists left_at timestamptz;

comment on column members.status is
  'active or inactive. Inactive members keep their history but receive nothing.';
comment on column members.left_at is
  'When they were marked inactive — the record of when they left the team.';
