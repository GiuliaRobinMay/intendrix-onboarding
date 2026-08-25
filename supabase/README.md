# Supabase setup

The database schema for the Intendrix Team Backend, ready to run. Nothing in
the app talks to Supabase yet — this prepares the tables so the wiring phase
can start.

## Apply

**Option A — one paste (simplest):**

1. Open the project's *SQL Editor* → *New query*.
2. Paste the whole of **`setup.sql`** and Run. It contains everything in
   order — schema, sign-in/roles, and the seed data (the Phoenix team, the
   three campaign blueprints with every series, lesson and email variant,
   and the five clients with their campaigns, sessions and assignments).
   Verified end-to-end against Postgres 16; the seed is idempotent, so
   re-running is safe.

**Option B — file by file:** run `migrations/0001_initial_schema.sql`,
then `migrations/0002_auth_roles_invitations.sql`, then `seed.sql`.

**Option C — Supabase CLI:**

```bash
supabase link --project-ref <project-ref>
supabase db push          # applies migrations/
psql "$DATABASE_URL" -f supabase/seed.sql
```

Both files are idempotent (`on conflict do nothing`) — safe to re-run.

## Table map

| Table | Prototype type (lib/types.ts) |
|---|---|
| `staff` | `StaffMember` (+ `scheduling_url`, `auth_user_id` for sign-in) |
| `clients` | `Client` (defaults: leader / coach / PM, Mighty links) |
| `members` | `Member` |
| `campaign_templates` | `CampaignTemplate` (blueprints) |
| `series_templates` | `SeriesTemplate` |
| `series_steps` | `SeriesStep` (cadence) |
| `step_contents` | `StepContent` — one row per variant (participant/leader) |
| `step_links` | `StepContent.extras` (Leaders Guides etc.) |
| `campaigns` | `Campaign` |
| `campaign_sessions` | `CampaignSession` |
| `campaign_series` | `LoadedSeries` (trigger binding lives here) |
| `campaign_phoenix_assignments` | `PhoenixAssignment` (person + role) |
| `campaign_client_assignments` | `ClientAssignment` (member + role) |
| `email_sends` | phase-3 sending engine log (no prototype equivalent) |
| `profiles` | one row per signed-up user: their role + scope (0002) |
| `invitations` | `Invitation` — pending invites created in Settings → Team |

Ordering that the prototype keeps in array order is a `sort_order` column
(sessions, series, steps, links). Statuses that the prototype derives
(campaign active/upcoming/closed, send sent/scheduled/awaiting) stay
derived — only the manual override (`campaigns.status_override`, including
`paused`) is stored.

## Sign-in, roles & invitations (0002)

Brad's choice: the email address is the account name, with a password the
person sets themselves. Nobody can self-register into the app — access only
comes through an invitation created in *Settings → Team*.

The flow, once the app is wired to Supabase:

1. A Phoenix admin invites someone from Settings → Team: email + role
   (+ company for a client admin). The app inserts an `invitations` row and
   calls `supabase.auth.admin.inviteUserByEmail(email)` (server-side, using
   the service-role key).
2. The person receives Supabase's invite email, follows the link and sets
   their own password.
3. The moment their auth user is created, the `handle_new_user` trigger
   provisions a `profiles` row, copying role and scope from the matching
   invitation and stamping it accepted. Someone who signs up without an
   invitation gets a profile with **no role — and no access to anything**.

Two roles (`app_role`), designed for the future Giulia described:

- **`phoenix_admin`** — the Phoenix team. Full access to every table.
- **`client_admin`** — an external person at a client company who runs
  certain campaigns. Row Level Security limits them to their own company:
  read their client + members, read **and update** that client's campaigns
  (sessions, series bindings, assignments), read their email log, and
  read-only access to the lesson library and staff names. They cannot see
  any other client, and they cannot touch blueprints or invitations.

The scoping is enforced in the **database** (RLS policies in 0002), not in
the UI — so even a client admin using the API directly can only ever reach
their own company's rows.

- `staff.auth_user_id` / `profiles.staff_id` link a Phoenix team member to
  their auth account once accounts exist.

## App wiring (live)

The app talks to the database through its own server (`app/api/state` reads
the whole tree, `app/api/action` persists each edit — the SQL mirror of the
reducer in `lib/state.tsx`). One environment variable switches it on:

```
DATABASE_URL=   # the Supabase connection string (Transaction pooler)
```

- **Where to find it:** Supabase dashboard → the project → *Connect* (top
  bar) → *Transaction pooler* — a `postgresql://…pooler.supabase.com:6543/…`
  URI. Replace `[YOUR-PASSWORD]` with the database password (resettable
  under *Project Settings → Database → Reset database password*).
- **Where to put it:** Vercel → the project → *Settings → Environment
  Variables* → add `DATABASE_URL`, then redeploy.
- Without the variable the app keeps running in prototype mode (edits stay
  in the browser); with it, everyone shares the database. The sidebar's
  bottom line shows which mode is active.

Sign-in (phase 3) additionally needs:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-side only
```
