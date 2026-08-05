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

Working flows: create a client · load module templates into a program (all
five, or one at a time) · set/change session dates (series schedule
recompute live) · add/remove members with Leader/Participant/Coach roles ·
edit every email subject/body, lesson label/URL, cadence offset and send
time inline · add/remove/reorder lessons in a series · create new series.

- **Dashboard** — stats, upcoming sends, program overview
- **Clients** — client organizations; detail view with session dates, loaded
  series, and members (Leader vs Participant series assignment)
- **Modules** — the reusable series template library (the five TLE-E series
  from Brad's document, with real lesson links, both variants, cadence,
  Leaders Guides, and embedded team-meeting instructions)
- **Progress** — full 26-week trajectory per client: sent / scheduled /
  awaiting-date per lesson
- **Settings** — organization, team, email sending, branding, integrations

### Key design ideas already reflected

- Five **independent** series (POEA, PWEA, PCS1, PCS2, PLS), each triggered
  by the date of the session it follows — enter a session date and the series
  schedules itself; no date, no sends.
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
