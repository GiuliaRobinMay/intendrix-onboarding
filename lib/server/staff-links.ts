// The links a Phoenix person carries, and how to read them from a
// database that may not have all the columns yet.
//
// Migrations are run by hand, so the code and the database can be a
// few days apart. Every reader of the staff table asks for the newest
// shape first and falls back to the older ones; the fields a database
// does not have yet simply read as empty.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface StaffLinks {
  /** their post in the community (1:1 Coaching Calls) — the fallback
   *  line when the two below are empty */
  schedulingUrl: string | null;
  /** their scheduling page for a phone call */
  phoneUrl: string | null;
  /** their scheduling page for a Zoom meeting */
  zoomUrl: string | null;
}

export const NO_LINKS: StaffLinks = { schedulingUrl: null, phoneUrl: null, zoomUrl: null };

export function linksOf(row: any): StaffLinks {
  return {
    schedulingUrl: row?.scheduling_url ?? null,
    phoneUrl: row?.phone_url ?? null,
    zoomUrl: row?.zoom_url ?? null,
  };
}

/** The link columns, newest shape first; "" is the shape before any. */
const SHAPES = [", scheduling_url, phone_url, zoom_url", ", scheduling_url", ""];

/** Run a staff query with the fullest column list the database has.
 *  `run` gets the extra columns to append after the fixed ones. */
export async function queryStaff<T>(run: (extraColumns: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const shape of SHAPES) {
    try {
      return await run(shape);
    } catch (err) {
      last = err;
    }
  }
  throw last;
}
