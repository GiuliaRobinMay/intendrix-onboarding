-- Intendrix — who a campaign's emails are sent by
--
-- Until now the sender was always a Phoenix coach. Brad's rule after the
-- Brio meeting: executive programmes send from a Phoenix coach, but
-- second-level programmes send from the client's own Transformational
-- Champion (e.g. Courtney at Brio).
--
-- The address stays on the Phoenix sending domain — a message claiming to
-- come from the client's own domain would fail their anti-spoofing checks.
-- The champion's name is what recipients see; replies go to her real
-- address.

alter table campaigns
  add column if not exists sender_member_id text
    references members (id) on delete set null;

comment on column campaigns.sender_member_id is
  'When set, this client member is the sender instead of the Phoenix coach. Their name is the display name; the address stays on the sending domain, with their real address as reply-to.';
