// Working days. Lessons must never land on a weekend or a US public
// holiday, so every step offset in a series is counted in working days:
// "7 days after the last one" means seven working days, which is nine
// calendar days when a weekend falls in between.
//
// Pure ISO-date arithmetic (YYYY-MM-DD). Never build a local Date from a
// date string here — that shifts the day across a timezone boundary.
//
// Used by both sides: lib/store.ts computes the schedule the app shows,
// app/api/cron/send computes the one the engine sends on. They have to
// agree to the day, so they share this file.

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function fromUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function utc(iso: string): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
}

/** Sunday = 0 … Saturday = 6, read in UTC so it can't drift. */
function weekday(iso: string): number {
  return new Date(utc(iso)).getUTCDay();
}

function isoOf(y: number, m: number, d: number): string {
  return fromUtc(Date.UTC(y, m - 1, d));
}

/** The nth given weekday of a month, e.g. the 3rd Monday in January. */
function nthWeekday(y: number, month: number, day: number, n: number): string {
  const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
  const offset = (day - first + 7) % 7;
  return isoOf(y, month, 1 + offset + (n - 1) * 7);
}

/** The last given weekday of a month, e.g. the last Monday in May. */
function lastWeekday(y: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, month - 1, lastDay)).getUTCDay();
  return isoOf(y, month, lastDay - ((last - day + 7) % 7));
}

/** A fixed-date holiday as actually observed: Saturday moves to the
 *  Friday before, Sunday to the Monday after. */
function observed(iso: string): string {
  const wd = weekday(iso);
  if (wd === 6) return fromUtc(utc(iso) - 86400000);
  if (wd === 0) return fromUtc(utc(iso) + 86400000);
  return iso;
}

/**
 * The eleven US federal holidays for one year, as observed.
 *
 * Phoenix's clients are all US-based. If a client ever wants to keep
 * sending on, say, Columbus Day, drop the line here — nothing else needs
 * to change.
 */
export function usHolidays(year: number): string[] {
  return [
    observed(isoOf(year, 1, 1)), //           New Year's Day
    nthWeekday(year, 1, 1, 3), //              Martin Luther King Jr. Day
    nthWeekday(year, 2, 1, 3), //              Presidents' Day
    lastWeekday(year, 5, 1), //                Memorial Day
    observed(isoOf(year, 6, 19)), //           Juneteenth
    observed(isoOf(year, 7, 4)), //            Independence Day
    nthWeekday(year, 9, 1, 1), //              Labor Day
    nthWeekday(year, 10, 1, 2), //             Columbus Day
    observed(isoOf(year, 11, 11)), //          Veterans Day
    nthWeekday(year, 11, 4, 4), //             Thanksgiving
    observed(isoOf(year, 12, 25)), //          Christmas Day
  ];
}

// Holiday sets are worked out once per year, not once per lesson.
const holidayCache = new Map<number, Set<string>>();

function holidaysFor(year: number): Set<string> {
  let set = holidayCache.get(year);
  if (!set) {
    set = new Set(usHolidays(year));
    holidayCache.set(year, set);
  }
  return set;
}

/** True on Monday–Friday, outside the US public holidays. */
export function isWorkday(iso: string): boolean {
  const wd = weekday(iso);
  if (wd === 0 || wd === 6) return false;
  return !holidaysFor(parts(iso)[0]).has(iso);
}

/** Why this date is not a working day — for tooltips. */
export function nonWorkdayReason(iso: string): string | null {
  const wd = weekday(iso);
  if (wd === 0 || wd === 6) return "weekend";
  return holidaysFor(parts(iso)[0]).has(iso) ? "US public holiday" : null;
}

/** The same day if it is a working day, otherwise the next one. */
export function nextWorkday(iso: string): string {
  let out = iso;
  // a run of non-working days is never longer than a week or so
  for (let i = 0; i < 30 && !isWorkday(out); i++) {
    out = fromUtc(utc(out) + 86400000);
  }
  return out;
}

/**
 * `days` working days after `iso`. An offset of 0 still moves off a
 * weekend or holiday — the send itself must land on a working day even
 * when the session it follows does not.
 */
export function addWorkdays(iso: string, days: number): string {
  let out = iso;
  let left = Math.max(0, Math.trunc(days));
  while (left > 0) {
    out = fromUtc(utc(out) + 86400000);
    if (isWorkday(out)) left--;
  }
  return nextWorkday(out);
}
