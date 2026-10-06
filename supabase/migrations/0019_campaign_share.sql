-- Intendrix — a campaign's own page, for the team living it
--
-- Every client team has a space in the community. This gives that space
-- something to hold: the lessons they have been sent, as a journey they
-- can walk back through, rather than a pile of old email.
--
-- The token is the whole address. It is generated per campaign, long
-- enough not to be guessed, and can be cleared — which takes the page
-- down without touching anything else. Nothing on that page is secret:
-- it is their own programme, shown back to them.

alter table campaigns
  add column if not exists share_token text;

create unique index if not exists campaigns_share_token_idx
  on campaigns (share_token);

comment on column campaigns.share_token is
  'The secret in this campaign''s public /journey link. Null means the page is off.';
