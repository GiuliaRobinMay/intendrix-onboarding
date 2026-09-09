-- Intendrix — where a client actually is
--
-- State and city, structured, next to the free-text location. The state
-- is what lets a new campaign default to the client's own timezone
-- instead of Eastern.

alter table clients
  add column if not exists state text;

alter table clients
  add column if not exists city text;

comment on column clients.state is
  'Two-letter US state code — drives the default timezone of new campaigns.';
