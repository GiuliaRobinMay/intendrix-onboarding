-- Intendrix — onboarding: the user agreement, and who joined the community
--
-- Each member carries their onboarding state: when the user agreement was
-- sent to them, when they accepted it (with the proof: IP, browser, and
-- which version of the text they saw), when they were invited into the
-- community, and when they actually joined it. The agreement token is
-- the secret in their personal accept link.

alter table members add column if not exists community_invited_at timestamptz;
alter table members add column if not exists community_joined_at  timestamptz;
alter table members add column if not exists agreement_sent_at    timestamptz;
alter table members add column if not exists agreement_signed_at  timestamptz;
alter table members add column if not exists agreement_version    text;
alter table members add column if not exists agreement_ip         text;
alter table members add column if not exists agreement_user_agent text;
alter table members add column if not exists agreement_token      text;

create unique index if not exists members_agreement_token_idx
  on members (agreement_token);

comment on column members.agreement_signed_at is
  'When this person clicked I Agree — with agreement_version, agreement_ip and agreement_user_agent as the proof.';
