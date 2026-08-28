-- Intendrix — day numbers on sessions, so a start date fills the calendar
--
-- Every send in a campaign hangs off a session date. Entering five session
-- dates by hand for every new client is the slow part, and the intervals
-- between them are the same programme after programme.
--
-- offset_days records that pattern: the number of days after the campaign
-- start date on which the session falls. "Fill dates from start" then
-- writes session_date = campaigns.start_date + offset_days, and moving one
-- session keeps the day numbers of the sessions that follow in step.

alter table campaign_sessions
  add column if not exists offset_days integer;

comment on column campaign_sessions.offset_days is
  'Days after campaigns.start_date on which this session falls. Null = no pattern; the date is only ever entered by hand.';
