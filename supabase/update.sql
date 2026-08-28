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


-- ——— check it landed ——————————————————————————————————————
-- Expect two rows.

select table_name, column_name
  from information_schema.columns
 where (table_name = 'campaigns'         and column_name = 'sender_member_id')
    or (table_name = 'campaign_sessions' and column_name = 'offset_days')
 order by table_name;
