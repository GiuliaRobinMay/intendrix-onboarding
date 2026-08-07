# Intendrix · Team Backend

The team-facing backend for Intendrix: client managers create customized
lesson trajectories (drip series of Intendrix lessons + emails) per client
organization. The client-facing side will live inside Mighty Networks and is
a later phase.

## Current phase: interactive prototype on the real app shell

This is the production Next.js app, running as a **fully clickable prototype
with no database or auth yet**. State is seeded from `lib/data.ts`, managed by
the reducer in `lib/state.tsx`, and persisted per-browser in localStorage
(reset it under Settings → Prototype data). Scheduling/statistics logic lives
in pure functions in `lib/store.ts`. In the Supabase phase the reducer actions
become database mutations behind the same interface — the UI doesn't change.

Working flows: create a client · create **as many campaigns per client as
needed** · add / rename / reorder / delete **any number of sessions** in a
campaign (zero to five or more) · set session dates (bound series reschedule
live) · load series into a campaign and **rebind each one to any session**
· reorder or unload series · add/remove members with Leader/Participant/Coach
roles · edit every email subject/body, lesson label/URL, cadence offset and
send time inline · add/remove/reorder lessons in a series · create new series.

- **Dashboard** — stats, upcoming sends, campaign overview
- **Clients** — client organizations; detail view lists every campaign for
  that client, plus members (Leader vs Participant series assignment)
- **Campaigns** — overview of all campaigns across all clients; detail view
  holds the sessions and the loaded series with their trigger bindings
- **Progress** — full trajectory per campaign: sent / scheduled /
  awaiting-date per lesson
- **Settings** — three tabs:
  - *App settings* — organization, email sending, branding, integrations
  - *Campaigns* — the campaign blueprint library. The list shows every
    blueprint; open one to manage its series; open a series to edit its
    lessons, emails and cadence
  - *Team* — users and (later) Google sign-in with roles

### Domain model

Design side (Settings → Campaigns):
`Campaign blueprint → Series → Steps (lessons)`

Delivery side:
`Client → Campaign → Sessions + loaded Series → Steps (lessons)`

A client campaign is created **from** a blueprint, which pre-loads its
series; from there it can be adapted per client.

- A **client** can run many **campaigns** (e.g. TLE-E for the executive team
  and TLE-S&M for middle management, in parallel or sequence).
- A **campaign** holds a variable list of **sessions** — the live and online
  meetings. Any number, including none.
- A **series** loaded into a campaign is **bound to one session**, whose date
  triggers it. Rebinding is how the team mixes the series order, which Brad
  asked for explicitly ("we may want to do Coaching Session 1 content after
  Coaching Session 2"). An unbound series simply never sends.
- Two audience variants per series (**Participant** / **Leader**) sent in
  tandem on an identical schedule; the model allows more variants and new
  series.
- Every send = editable email + lesson link(s); Leaders Guides ride along on
  the leader variant; TEAM MEETING instructions are flagged.
- Known content gaps are flagged in the UI (e.g. the missing "Being
  Impactful" lesson link, Amber's pending welcome video).

Member names for CareSouth are **sample data** (roles/structure are real:
1 CEO leader + 18 participants).

## Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · TypeScript ·
lucide-react. Planned: Supabase (Postgres, Google auth), Vercel hosting,
transactional email provider (to decide).

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

## Brand

Palette: `#050714` ink · `#14143c` navy · `#2c2d83` indigo · `#eb320f`
flame · `#aeb0b2` mist · `#eeeeef` paper, with the signature red→indigo
gradient. Logo is currently a wordmark placeholder.
