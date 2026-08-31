-- Intendrix — members get a first and a last name
--
-- {{first_name}} in an email should never be guesswork. The single name
-- field becomes first + last; existing rows are split on the first space
-- ("Lindsay Mann-Shanahan" → Lindsay / Mann-Shanahan). The joined name
-- column stays — it is what lists and logs display — and the app keeps
-- it in step whenever a part changes.

alter table members
  add column if not exists first_name text,
  add column if not exists last_name  text;

update members
   set first_name = coalesce(first_name, nullif(split_part(name, ' ', 1), '')),
       last_name  = coalesce(
         last_name,
         nullif(btrim(substr(name, length(split_part(name, ' ', 1)) + 1)), '')
       )
 where first_name is null or last_name is null;

comment on column members.first_name is
  'What {{first_name}} in a lesson email becomes for this person.';
