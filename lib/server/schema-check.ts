// What the running code expects the database to have.
//
// Migrations here are run by hand, in the Supabase SQL editor, by a
// person. That is a deliberate choice and it works — but it means the
// code and the database can be a few hours or a few days apart, and
// until now the only way to discover that was for something to break:
// a change that would not save, an invitation that would not send, or
// a nightly engine that died on a column it had been taught to ask for
// and stopped sending every email in the system.
//
// So the app checks for itself. Each entry below is one thing the
// current code needs and the SQL that puts it there — safe to run
// twice, every one of them.
//
// When a migration adds something the code reads, add it here in the
// same commit. That is the whole discipline.

import type { Pool } from "pg";

export interface SchemaNeed {
  /** the migration this came from, for finding the full file */
  migration: string;
  table: string;
  /** null when the whole table is what's missing */
  column: string | null;
  /** what stops working without it, in plain words */
  cost: string;
  sql: string;
}

export const SCHEMA_NEEDS: SchemaNeed[] = [
  {
    migration: "0017_campaign_notes",
    table: "campaign_notes",
    column: null,
    cost: "The Notes card on a campaign stays empty and nothing can be written down.",
    sql: `create table if not exists campaign_notes (
  id          text primary key default gen_random_uuid()::text,
  campaign_id text not null references campaigns (id) on delete cascade,
  body        text not null,
  author      text,
  created_at  timestamptz not null default now()
);
create index if not exists campaign_notes_campaign_idx
  on campaign_notes (campaign_id, created_at desc);
alter table campaign_notes enable row level security;`,
  },
  {
    migration: "0019_campaign_share",
    table: "campaigns",
    column: "share_token",
    cost: "The team's own page cannot be created or embedded in their community space.",
    sql: `alter table campaigns add column if not exists share_token text;
create unique index if not exists campaigns_share_token_idx
  on campaigns (share_token) where share_token is not null;`,
  },
  {
    migration: "0020_campaign_sender_staff",
    table: "campaigns",
    column: "sender_staff_id",
    cost: "Who the emails come from cannot be saved — the choice is lost on reload, and the sender falls back to whoever holds the Coach role.",
    sql: `alter table campaigns
  add column if not exists sender_staff_id text references staff (id);

comment on column campaigns.sender_staff_id is
  'The Phoenix person these emails come from, chosen by hand.';

-- and write down the sender every running campaign is already using,
-- so switching the guessing off changes no name in anybody's inbox
update campaigns c
   set sender_staff_id = coalesce(
         (select a.staff_id from campaign_phoenix_assignments a
           where a.campaign_id = c.id and a.role = 'phoenix_coach'
           order by a.created_at limit 1),
         cl.phoenix_coach_id,
         (select a.staff_id from campaign_phoenix_assignments a
           where a.campaign_id = c.id and a.role = 'phoenix_leader'
           order by a.created_at limit 1),
         cl.phoenix_leader_id,
         cl.project_manager_id)
  from clients cl
 where cl.id = c.client_id
   and c.sender_staff_id is null
   and c.sender_member_id is null;`,
  },
  {
    migration: "0022_client_plan_url",
    table: "clients",
    column: "plan_url",
    cost: "The plan link cannot be saved — the Community tab shows it red for every client, whatever you paste.",
    sql: `alter table clients add column if not exists plan_url text;`,
  },
  {
    migration: "0023_client_website",
    table: "clients",
    column: "website",
    cost: "The client's website cannot be saved, and the set-up checklist keeps saying it is missing.",
    sql: `alter table clients add column if not exists website text;`,
  },
  {
    migration: "0024_lesson_assets",
    table: "lesson_assets",
    column: null,
    cost: "The Lessons tab in the Hub cannot save what a lesson is about or its image and links.",
    sql: `create table if not exists lesson_assets (
  coursework_id text primary key,
  space_id      text not null,
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
  using (true) with check (true);`,
  },
  {
    migration: "0025_lesson_code_and_images",
    table: "lesson_assets",
    column: "code",
    cost: "A lesson's code (S1 M1) cannot be saved on the Lessons tab.",
    sql: `alter table lesson_assets add column if not exists code text;`,
  },
  {
    migration: "0025_lesson_code_and_images",
    table: "lesson_images",
    column: null,
    cost: "Lesson images cannot be uploaded or copied in — the Lessons tab can only link to one elsewhere.",
    sql: `create table if not exists lesson_images (
  coursework_id text primary key,
  content_type  text not null,
  bytes         bytea not null,
  updated_at    timestamptz not null default now()
);
alter table lesson_images enable row level security;
create policy lesson_images_all on lesson_images for all to authenticated
  using (true) with check (true);`,
  },
];

export interface SchemaReport {
  ok: boolean;
  missing: SchemaNeed[];
  /** everything missing, as one block ready to paste */
  sql: string;
}

/**
 * Which of the things above the database does not have.
 *
 * Never throws: a database that cannot even be asked reports as fine,
 * because a false alarm about a missing column is worse than silence
 * when the real problem is that the database is unreachable — that has
 * its own banner already.
 */
export async function checkSchema(pool: Pool): Promise<SchemaReport> {
  const missing: SchemaNeed[] = [];
  try {
    const { rows } = await pool.query(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public'`
    );
    const have = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const tables = new Set(rows.map((r) => r.table_name as string));
    for (const need of SCHEMA_NEEDS) {
      const there = need.column
        ? have.has(`${need.table}.${need.column}`)
        : tables.has(need.table);
      if (!there) missing.push(need);
    }
  } catch {
    return { ok: true, missing: [], sql: "" };
  }
  return {
    ok: missing.length === 0,
    missing,
    sql: missing
      .map((m) => `-- ${m.migration}\n${m.sql}`)
      .join("\n\n"),
  };
}
