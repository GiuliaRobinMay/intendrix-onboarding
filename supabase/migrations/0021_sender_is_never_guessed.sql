-- Who the emails come from stops being a deduction.
--
-- Until now a campaign with no sender fell back to whoever held the
-- Coach role on the team card. That is how CareSouth's lessons went out
-- as Natalie: two people held the role and the older row won.
--
-- The sender is chosen by hand from today. This writes down the choice
-- every running campaign is already making, so that turning the
-- guessing off changes no name in anybody's inbox — it only stops the
-- app deciding for itself tomorrow.
--
-- Safe to run twice: it only ever fills a campaign that has nobody.

update campaigns c
   set sender_staff_id = coalesce(
         (select a.staff_id from campaign_phoenix_assignments a
           where a.campaign_id = c.id and a.role = 'phoenix_coach'
           order by a.created_at limit 1),
         cl.phoenix_coach_id,
         (select a.staff_id from campaign_phoenix_assignments a
           where a.campaign_id = c.id and a.role = 'phoenix_leader'
           order by a.created_at limit 1),
         cl.phoenix_leader_id,
         (select a.staff_id from campaign_phoenix_assignments a
           where a.campaign_id = c.id and a.role = 'project_manager'
           order by a.created_at limit 1),
         cl.project_manager_id
       )
  from clients cl
 where cl.id = c.client_id
   and c.sender_staff_id is null
   and c.sender_member_id is null;

comment on column campaigns.sender_staff_id is
  'The Phoenix person these emails come from, chosen by hand. Null together with sender_member_id means this campaign has no sender.';

-- ——— check it landed ——————————————————————————————————————
-- Every campaign should now name a sender. Any row listed here has
-- nobody on its team card either, and needs one picked by hand.

select c.id, c.name, cl.short_name as client
  from campaigns c
  join clients cl on cl.id = c.client_id
 where c.sender_staff_id is null and c.sender_member_id is null;
