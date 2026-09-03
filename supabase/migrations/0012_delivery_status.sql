-- Intendrix — what happened to each email after it left
--
-- The provider (Resend) reports the life of every email through webhooks:
-- delivered, opened, clicked, bounced, complained. Each send row keeps the
-- provider's id so those reports can find it again, and the latest event
-- with its time. Opens undercount by nature (image blocking); clicks are
-- the reliable engagement signal; bounces flag bad addresses.

alter table email_sends
  add column if not exists provider_id text;

alter table email_sends
  add column if not exists last_event text;

alter table email_sends
  add column if not exists last_event_at timestamptz;

create index if not exists email_sends_provider_id
  on email_sends (provider_id);

comment on column email_sends.provider_id is
  'The provider''s id for this email — how delivery webhooks find the row.';
comment on column email_sends.last_event is
  'Latest delivery event: sent, delivered, opened, clicked, bounced, complained, failed.';
