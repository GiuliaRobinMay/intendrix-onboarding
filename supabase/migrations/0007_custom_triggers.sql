-- Intendrix — triggers and session kinds become free text
--
-- The five standard session kinds were a closed list, so a series could
-- only ever be "usually triggered by" one of them. Real programmes have
-- more shapes than that — Pre-Planning Sessions before the orientation,
-- for a start — and the team should be able to name their own.
--
-- Both columns become plain text. The standard values keep working
-- unchanged (auto-binding matches on equality, as before); anything new
-- is just another string. Safe to re-run.

alter table series_templates
  alter column trigger_kind type text using trigger_kind::text;

alter table campaign_sessions
  alter column kind type text using kind::text;

comment on column series_templates.trigger_kind is
  'The session that usually starts this series. Standard: orientation, workshop, coaching1, coaching2, launch — or any custom name, e.g. "Pre-Planning Session".';
