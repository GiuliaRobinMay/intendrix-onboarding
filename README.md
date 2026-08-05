# Intendrix · Team Backend

The team-facing backend for Intendrix: client managers create customized
lesson trajectories (drip series of Intendrix lessons + emails) per client
organization. The client-facing side will live inside Mighty Networks and is
a later phase.

## Current phase: UX mockup on the real app shell

This is the production Next.js app, running on a **mock data layer** — no
database, no auth yet. All screens read through `lib/store.ts`, so swapping
the mock source (`lib/data.ts`) for Supabase later does not touch the UI.

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
