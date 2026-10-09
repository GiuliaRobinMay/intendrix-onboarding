// One colour per status, defined once.
//
// These lived in four files and had already drifted: the campaigns
// list, the campaign page, the status chip and the row dropdowns each
// carried their own copy, so changing a colour meant finding all four
// and missing one.
//
// What the colours mean, now that they say the same thing everywhere:
//
//   green   running, nothing to do
//   indigo  not started yet — a campaign that is Upcoming and a client
//           still Onboarding are the same fact about different things,
//           and used to be two unrelated colours
//   red     Paused. The only status that means somebody stopped
//           something on purpose, which is the one worth catching from
//           across the room
//   yellow  finished — over, but not nothing
//   grey    archived

export const TONE = {
  green: "#4ade80",
  indigo: "#a3a4f0",
  red: "#ff7a55",
  yellow: "#facc15",
  grey: "#aeb0b2",
} as const;

/** The same colour as a faint background wash, for chips. */
export const wash = (hex: string) => `color-mix(in srgb, ${hex} 15%, transparent)`;

export const CAMPAIGN_TONE = {
  active: TONE.green,
  upcoming: TONE.indigo,
  paused: TONE.red,
  closed: TONE.yellow,
} as const;

export const CLIENT_TONE = {
  active: TONE.green,
  onboarding: TONE.indigo,
  archived: TONE.grey,
} as const;
