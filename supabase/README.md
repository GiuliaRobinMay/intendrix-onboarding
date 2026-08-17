# Supabase setup

The database schema for the Intendrix Team Backend, ready to run. Nothing in
the app talks to Supabase yet — this prepares the tables so the wiring phase
can start.

## Apply

**Option A — Supabase Studio (simplest):**

1. Create a project at supabase.com (organization: Phoenix's own account —
   Kevin is setting up the environment).
2. Open *SQL Editor* → *New query*.
3. Paste and run `migrations/0001_initial_schema.sql`.
4. Paste and run `seed.sql` — loads the current prototype data: the Phoenix
   team, the three campaign blueprints (TLE-E, TLE-L, TLE-IC) with every
   series, lesson and email variant, and the five clients with their
   campaigns, sessions and assignments.

**Option B — Supabase CLI:**

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

Ordering that the prototype keeps in array order is a `sort_order` column
(sessions, series, steps, links). Statuses that the prototype derives
(campaign active/upcoming/closed, send sent/scheduled/awaiting) stay
derived — only the manual override (`campaigns.status_override`, including
`paused`) is stored.

## Security

- RLS is enabled on every table with one policy: any **authenticated** user
  has full access. That fits the internal team tool with email + password
  sign-in; tighten per-role later (edit blueprints vs run campaigns).
- `staff.auth_user_id` links a team member to their Supabase auth user once
  accounts exist.

## App wiring (next phase)

Environment variables the app will need (in Vercel, never committed):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-side only
```

The UI already reads everything through the reducer in `lib/state.tsx`;
wiring means replacing those actions with Supabase queries/mutations behind
the same interface.
