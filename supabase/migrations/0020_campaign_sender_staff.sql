-- Intendrix — who the emails come from, said plainly
--
-- The sender was inferred from a role: whoever held "Phoenix Coach" on
-- a campaign's team was the From address. So adding a colleague to a
-- campaign changed who its emails appeared to come from, silently, and
-- two people holding the role made it worse — CareSouth's lessons went
-- out for six weeks under a name nobody had chosen.
--
-- A campaign's sender is now a thing you set, not a thing deduced.
-- Null still means "the Phoenix Coach", so nothing changes for the
-- campaigns that never needed to say.

alter table campaigns
  add column if not exists sender_staff_id text references staff (id);

comment on column campaigns.sender_staff_id is
  'The Phoenix person these emails come from. Null means whoever holds the Coach role.';
