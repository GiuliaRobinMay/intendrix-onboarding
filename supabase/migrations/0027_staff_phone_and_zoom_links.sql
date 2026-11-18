-- Intendrix — a phone link and a Zoom link per Phoenix person
--
-- Each coach schedules two kinds of call, and each kind has its own
-- page: one for a phone call, one for a Zoom meeting. Both go under
-- the sign-off of every lesson email they send, as two lines. The
-- older scheduling_url keeps their post in the community and is used
-- only when these two are empty.

alter table staff add column if not exists phone_url text;
alter table staff add column if not exists zoom_url  text;

comment on column staff.phone_url is 'Their scheduling page for a phone call.';
comment on column staff.zoom_url  is 'Their scheduling page for a Zoom meeting.';

-- The links the team shared, matched on first name. Only empty rows
-- are touched, so what is pasted on the Team page later always wins.
update staff set phone_url = v.url
  from (values
    ('brad',    'https://phoenixperform.as.me/BradZimmerman'),
    ('kevin',   'https://phoenixperform.as.me/KevinDavis'),
    ('natalie', 'https://phoenixperform.as.me/NatalieThompson'),
    ('tom',     'https://phoenixperform.as.me/Tom'),
    ('tim',     'https://phoenixperform.as.me/TimMatthews')
  ) as v (first, url)
 where lower(split_part(trim(staff.name), ' ', 1)) = v.first
   and staff.phone_url is null;

update staff set zoom_url = v.url
  from (values
    ('brad',    'https://phoenixperform.as.me/Zoom-Brad'),
    ('kevin',   'https://phoenixperform.as.me/Zoom-Kevin60'),
    ('natalie', 'https://phoenixperform.as.me/ZoomMeetingNatalie50mins'),
    ('tom',     'https://phoenixperform.as.me/Zoom-Tom'),
    ('tim',     'https://phoenixperform.as.me/ZoomMeetingTim50mins')
  ) as v (first, url)
 where lower(split_part(trim(staff.name), ' ', 1)) = v.first
   and staff.zoom_url is null;
