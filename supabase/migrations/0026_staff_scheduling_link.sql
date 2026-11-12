-- Intendrix — a Phoenix person's scheduling link
--
-- A client asked for it: every lesson email should end with a way to
-- book time with the person who sent it. Each Phoenix coach has one
-- scheduling page (a phone call, and a Zoom meeting where they offer
-- one); the link is kept on their team row and printed under their
-- sign-off as "Schedule a call with <name>". Empty means no line.

alter table staff add column if not exists scheduling_url text;

comment on column staff.scheduling_url is
  'The person''s scheduling page, shown under the sign-off of every lesson email they send.';

-- The five links the team shared, matched on first name. Only rows
-- without a link are touched, so whatever is pasted on the Team page
-- later always wins.
update staff set scheduling_url = v.url
  from (values
    ('brad',    'https://phoenixperform.as.me/BradZimmerman'),
    ('kevin',   'https://phoenixperform.as.me/KevinDavis'),
    ('natalie', 'https://phoenixperform.as.me/NatalieThompson'),
    ('tom',     'https://phoenixperform.as.me/Tom'),
    ('tim',     'https://phoenixperform.as.me/TimMatthews')
  ) as v (first, url)
 where lower(split_part(trim(staff.name), ' ', 1)) = v.first
   and staff.scheduling_url is null;
