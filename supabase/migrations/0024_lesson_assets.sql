-- Intendrix — what each lesson in the community is about, and its media
--
-- The lesson spaces, their modules and their lessons live in Mighty
-- Networks and are read from there. What Mighty does not hold is the
-- material the team sends about a lesson: a line on what it is about,
-- the image that goes on a post or at the top of an email, and the
-- PDF, video and podcast links. One row per lesson, keyed by Mighty's
-- own id for it, so it survives a retitle.

create table if not exists lesson_assets (
  coursework_id text primary key,            -- Mighty's id for the lesson
  space_id      text not null,               -- the lesson space it is in
  about         text not null default '',
  image_url     text,
  pdf_url       text,
  video_url     text,
  podcast_url   text,
  updated_at    timestamptz not null default now()
);
create index if not exists lesson_assets_space_idx on lesson_assets (space_id);

alter table lesson_assets enable row level security;
create policy lesson_assets_all on lesson_assets for all to authenticated
  using (true) with check (true);
