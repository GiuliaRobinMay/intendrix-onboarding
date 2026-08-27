-- ============================================================
-- Intendrix — go-live helper
--
-- Run this in the Supabase SQL editor AFTER setup.sql, when the real
-- Phoenix team and the first real client are known. Every section is
-- independent: edit the values, run the section, ignore the rest.
--
-- Safe to run more than once.
-- ============================================================


-- ——— 1. The Phoenix team ———————————————————————————————————
--
-- These rows decide which address each client's lessons are sent FROM,
-- so the email addresses must be the real ones on the sending domain
-- (phoenixperform.com). There is no screen for this yet — edit here.
--
-- Replace the four rows below with the real team. Keep the ids short
-- and lowercase; they never change once campaigns point at them.

insert into staff (id, name, role_title, initials, email) values
  ('brad',   'Brad Zimmerman', 'Phoenix Coach · Owner', 'BZ', 'brad@phoenixperform.com'),
  ('kevin',  'Kevin',          'Phoenix Coach',         'KV', 'kevin@phoenixperform.com'),
  ('amber',  'Amber',          'Program Coordinator',   'AM', 'amber@phoenixperform.com'),
  ('giulia', 'Giulia May',     'Community & Platform',  'GM', 'giulia@phoenixperform.com')
on conflict (id) do update
  set name       = excluded.name,
      role_title = excluded.role_title,
      initials   = excluded.initials,
      email      = excluded.email;

-- Add someone new to the team:
-- insert into staff (id, name, role_title, initials, email)
-- values ('sarah', 'Sarah Doe', 'Phoenix Coach', 'SD', 'sarah@phoenixperform.com')
-- on conflict (id) do nothing;


-- ——— 2. The first portal login ————————————————————————————
--
-- Nobody can enter the portal without an invitation — including the
-- first person. This creates that first invitation. Afterwards, invite
-- everyone else from inside the app (Settings → Team).
--
-- Put the real email address here, then invite the same address from
-- the Supabase dashboard (Authentication → Users → Add user → Send
-- invitation). The role below is what they get when they accept.

-- staff_id links the login to the team member, so the person who signs
-- in and the person you assign to campaigns are one and the same.

insert into invitations (email, role, staff_id)
select 'giulia.gaianet@gmail.com', 'phoenix_admin', 'giulia'
where not exists (
  select 1 from invitations
   where lower(email) = lower('giulia.gaianet@gmail.com')
     and accepted_at is null
);

-- Check who already has access:
-- select email, role, client_id from profiles order by created_at;


-- ——— 3. Bulk-add participants to a client —————————————————
--
-- The app adds members one at a time, which is slow for a group of 50+.
-- Paste the list here instead: one line per person,
--   (name, email, role, job title)
-- role is 'participant', 'leader' (receives the Leader series) or
-- 'coach' (receives a copy of every send).
--
-- Set the client id on the first line — 'brio' for Brio Living Services.

insert into members (client_id, name, email, role, title)
select 'brio', * from (values
  ('Example Person',  'example.person@brio.org',  'participant'::member_role, 'Manager'),
  ('Example Leader',  'example.leader@brio.org',  'leader'::member_role,      'CEO')
  -- add one line per participant, comma-separated
) as incoming(name, email, role, title)
where not exists (
  select 1 from members m
   where m.client_id = 'brio' and lower(m.email) = lower(incoming.email)
);

-- Count what landed:
-- select c.name, count(*) from members m
--   join clients c on c.id = m.client_id group by c.name;


-- ——— 4. Before the first real send ————————————————————————
--
-- A dry run of the engine costs nothing and shows exactly what would go
-- out. Do it from a browser (signed out is fine):
--   https://<the-app-url>/api/cron/send?dryrun=1
-- with the header  Authorization: Bearer <CRON_SECRET>
--
-- Anything more than two days overdue is never auto-sent; it is logged
-- as "held" for the team to review:
-- select status, count(*) from email_sends group by status;
