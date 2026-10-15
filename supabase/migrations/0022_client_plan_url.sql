-- Intendrix — the client's plan link
--
-- Three links belong to a client in Mighty Networks: the space (where
-- their team meets), the plan (the access rule that opens that space),
-- and the invitation link (what a member clicks to join through that
-- plan). The space and the invitation were already kept; the plan was
-- in the master sheet only. The Community tab shows all three side by
-- side, so the plan link gets a column too.

alter table clients add column if not exists plan_url text;

comment on column clients.plan_url is
  'The Mighty Networks plan that gives access to this client''s space.';
