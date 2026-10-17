-- Intendrix — the client's website
--
-- One more fact about the organisation, next to state and city: where
-- they are on the web. It sits on the client facts card and is one of
-- the lines on the set-up checklist.

alter table clients add column if not exists website text;

comment on column clients.website is 'The client organisation''s website.';
