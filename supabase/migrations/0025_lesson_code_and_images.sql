-- Intendrix — a lesson's code, and its image kept here
--
-- Every lesson carries a code like S1 M1, printed on its PDF; it goes
-- on the row so the team can talk about lessons by number.
--
-- The image for a lesson is copied in and kept in the database, not
-- linked: a link to somebody else's server breaks the day they move
-- the file, and an email or a post with a broken picture at the top
-- is worse than none. The app serves the bytes itself.

alter table lesson_assets add column if not exists code text;

create table if not exists lesson_images (
  coursework_id text primary key,
  content_type  text not null,
  bytes         bytea not null,
  updated_at    timestamptz not null default now()
);

alter table lesson_images enable row level security;
create policy lesson_images_all on lesson_images for all to authenticated
  using (true) with check (true);
