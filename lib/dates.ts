// Dates, written the way Phoenix reads them.
//
// Everyone this app is written for works in the United States, so a date
// is month first: 10/07/2026 is the seventh of October. The browser is no
// guide here — it writes dates in the locale of whoever is sitting in
// front of it, which is how the same lesson came to read 07/10 on one
// screen and 10/07 on another.

/**
 * The ISO day (yyyy-mm-dd) a date stands for on the calendar.
 *
 * toISOString() converts to UTC first, so a Date standing for local
 * midnight comes back as the day before for anyone east of Greenwich.
 * A send date is a day on a calendar, never an instant.
 */
export function isoDay(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** mm/dd/yyyy, straight off the calendar parts — no Date in between. */
export function usDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = isoDay(d).split("-");
  return y && m && day ? `${m}/${day}/${y}` : "";
}
